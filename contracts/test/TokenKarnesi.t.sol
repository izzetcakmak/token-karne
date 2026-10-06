// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TokenKarnesi} from "../TokenKarnesi.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Handler used by the invariant suite to drive state changes.
// ─────────────────────────────────────────────────────────────────────────────
contract TokenKarnesiHandler is Test {
    TokenKarnesi public board;
    MockERC20    public usdc;

    address internal owner;
    address internal alice;

    // Track total fees paid in (via submitScore) and total withdrawn.
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    // Tracks whether the last call was a withdraw (used by invariant).
    bool public lastCallWasWithdraw;

    constructor(TokenKarnesi _board, MockERC20 _usdc, address _owner, address _alice) {
        board  = _board;
        usdc   = _usdc;
        owner  = _owner;
        alice  = _alice;
    }

    /// @dev Fuzz-driven submitScore; seeds allowance & balance before calling.
    function submitScore(address tokenCA, uint8[12] calldata scoreValues, uint8 total) external {
        // skip zero address – that's a revert path, not an invariant driver
        if (tokenCA == address(0)) return;
        // keep each score ≤ 1 and total ≤ 12 so the call succeeds
        uint8[12] memory safeScores;
        for (uint256 i; i < 12; ++i) safeScores[i] = scoreValues[i] % 2;
        uint8 safeTotal = total % 13;

        uint256 currentFee = board.fee();
        usdc.mint(alice, currentFee);
        vm.prank(alice);
        usdc.approve(address(board), currentFee);
        vm.prank(alice);
        board.submitScore(tokenCA, safeScores, safeTotal);
        totalDeposited += currentFee;
        lastCallWasWithdraw = false;
    }

    /// @dev Owner withdraws; records the amount.
    function withdraw() external {
        uint256 bal = usdc.balanceOf(address(board));
        if (bal == 0) return;
        vm.prank(owner);
        board.withdraw();
        totalWithdrawn += bal;
        lastCallWasWithdraw = true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test contract
// ─────────────────────────────────────────────────────────────────────────────
contract TokenKarnesiTest is Test {
    // ── canonical Arc Testnet USDC address ──────────────────────────────────
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    TokenKarnesi internal board;
    MockERC20    internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");

    uint256 internal constant INITIAL_FEE = 100_000; // 0.10 USDC (6 decimals)
    uint256 internal constant MINT_AMOUNT  = 10_000_000; // 10 USDC

    // Deterministic non-zero token address used across tests
    address internal constant TOKEN_CA = address(0xDEAD);

    // Valid score array (all zeros, total = 0) – overridden per test as needed
    uint8[12] internal ZERO_SCORES;

    // ── setUp ─────────────────────────────────────────────────────────────────
    function setUp() public {
        // 1. Deploy mock ERC-20 to throwaway address, then etch its bytecode
        //    onto the canonical Arc USDC address so the immutable in the
        //    contract under test resolves correctly.
        MockERC20 mockDeploy = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.etch(USDC_ADDR, address(mockDeploy).code);
        usdc = MockERC20(USDC_ADDR);

        // 2. Deploy the contract under test; passes the canonical USDC address.
        vm.prank(owner);
        board = new TokenKarnesi(USDC_ADDR, INITIAL_FEE, owner);

        // 3. Seed alice with USDC and approve the board.
        usdc.mint(alice, MINT_AMOUNT);
        vm.prank(alice);
        usdc.approve(address(board), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. DEPLOYMENT & INITIALISATION
    // ═══════════════════════════════════════════════════════════════════════

    function test_Constructor_SetsStateCorrectly() public view {
        assertEq(address(board.usdc()), USDC_ADDR);
        assertEq(board.fee(),  INITIAL_FEE);
        assertEq(board.owner(), owner);
    }

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(TokenKarnesi.ZeroAddress.selector);
        new TokenKarnesi(address(0), INITIAL_FEE, owner);
    }

    function test_Constructor_RevertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new TokenKarnesi(USDC_ADDR, INITIAL_FEE, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. submitScore — happy paths
    // ═══════════════════════════════════════════════════════════════════════

    function test_SubmitScore_StoresRecord() public {
        uint8[12] memory scores;
        scores[0] = 1; scores[1] = 1; // 2 out of 12 = total 2
        uint8 total = 2;

        vm.warp(1_000);
        vm.prank(alice);
        board.submitScore(TOKEN_CA, scores, total);

        TokenKarnesi.ScoreRecord memory rec = board.getScore(TOKEN_CA);
        assertEq(rec.submitter,    alice,   "submitter mismatch");
        assertEq(rec.total,        total,   "total mismatch");
        assertEq(rec.timestamp,    1_000,   "timestamp mismatch");
        assertEq(rec.scores[0],    1,       "score[0] mismatch");
        assertEq(rec.scores[1],    1,       "score[1] mismatch");
    }

    function test_SubmitScore_TransfersFeeToContract() public {
        uint256 aliceBefore   = usdc.balanceOf(alice);
        uint256 contractBefore = usdc.balanceOf(address(board));

        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        assertEq(usdc.balanceOf(alice),          aliceBefore - INITIAL_FEE,    "alice balance wrong");
        assertEq(usdc.balanceOf(address(board)),  contractBefore + INITIAL_FEE, "board balance wrong");
    }

    function test_SubmitScore_BoundaryTotal_12() public {
        // total == 12 is the maximum valid value
        uint8[12] memory allOnes = [1,1,1,1,1,1,1,1,1,1,1,1];
        vm.prank(alice);
        board.submitScore(TOKEN_CA, allOnes, 12); // should not revert
        assertEq(board.getScore(TOKEN_CA).total, 12);
    }

    function test_SubmitScore_BoundaryScoreValue_1() public {
        // scoreValues[i] == 1 is the maximum valid value
        uint8[12] memory oneScore;
        oneScore[0] = 1;
        vm.prank(alice);
        board.submitScore(TOKEN_CA, oneScore, 1); // should not revert
        assertEq(board.getScore(TOKEN_CA).scores[0], 1);
    }

    // ── submitScore: overwriting a prior record ──────────────────────────────
    function test_SubmitScore_OverwritesPriorRecord() public {
        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        uint8[12] memory newScores;
        newScores[3] = 1;
        vm.prank(alice);
        board.submitScore(TOKEN_CA, newScores, 1);

        TokenKarnesi.ScoreRecord memory rec = board.getScore(TOKEN_CA);
        assertEq(rec.total,        1, "total not updated");
        assertEq(rec.scores[3],    1, "score[3] not updated");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. submitScore — revert paths
    // ═══════════════════════════════════════════════════════════════════════

    function test_SubmitScore_RevertsOnZeroTokenCA() public {
        vm.prank(alice);
        vm.expectRevert(TokenKarnesi.InvalidTokenAddress.selector);
        board.submitScore(address(0), ZERO_SCORES, 0);
    }

    function test_SubmitScore_RevertsOnTotalAbove12() public {
        vm.prank(alice);
        vm.expectRevert(TokenKarnesi.InvalidTotal.selector);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 13);
    }

    function test_SubmitScore_RevertsOnScoreValueAbove1_Index0() public {
        uint8[12] memory bad;
        bad[0] = 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TokenKarnesi.InvalidScoreValue.selector, uint256(0)));
        board.submitScore(TOKEN_CA, bad, 0);
    }

    function test_SubmitScore_RevertsOnScoreValueAbove1_LastIndex() public {
        uint8[12] memory bad;
        bad[11] = 3;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TokenKarnesi.InvalidScoreValue.selector, uint256(11)));
        board.submitScore(TOKEN_CA, bad, 0);
    }

    function test_SubmitScore_RevertsOnInsufficientAllowance() public {
        // bob has no allowance
        usdc.mint(bob, MINT_AMOUNT);
        // approve 0 (default is 0 for fresh address)
        vm.prank(bob);
        vm.expectRevert(); // SafeERC20 will revert on insufficient allowance
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);
    }

    function test_SubmitScore_RevertsOnInsufficientBalance() public {
        // carol has no USDC at all; she has infinite allowance but zero balance
        address carol = makeAddr("carol");
        vm.prank(carol);
        usdc.approve(address(board), type(uint256).max);

        vm.prank(carol);
        vm.expectRevert(); // SafeERC20 will revert on insufficient balance
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. getScore — happy path
    // ═══════════════════════════════════════════════════════════════════════

    function test_GetScore_ReturnsZeroRecordForUnknownToken() public view {
        TokenKarnesi.ScoreRecord memory rec = board.getScore(TOKEN_CA);
        assertEq(rec.submitter, address(0));
        assertEq(rec.total,     0);
        assertEq(rec.timestamp, 0);
    }

    function test_GetScore_ReturnsCorrectRecord() public {
        uint8[12] memory scores;
        scores[5] = 1;
        vm.prank(alice);
        board.submitScore(TOKEN_CA, scores, 1);

        TokenKarnesi.ScoreRecord memory rec = board.getScore(TOKEN_CA);
        assertEq(rec.submitter, alice);
        assertEq(rec.total,     1);
        assertEq(rec.scores[5], 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. withdraw — happy path
    // ═══════════════════════════════════════════════════════════════════════

    function test_Withdraw_SendsAllUsdcToOwner() public {
        // fund the contract via submitScore
        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        uint256 contractBalance = usdc.balanceOf(address(board));
        assertEq(contractBalance, INITIAL_FEE);

        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        board.withdraw();

        assertEq(usdc.balanceOf(address(board)), 0,                        "contract not drained");
        assertEq(usdc.balanceOf(owner),          ownerBefore + contractBalance, "owner not credited");
    }

    // ── withdraw: revert paths ───────────────────────────────────────────────
    function test_Withdraw_RevertsWhenBalanceIsZero() public {
        vm.prank(owner);
        vm.expectRevert(TokenKarnesi.InsufficientBalance.selector);
        board.withdraw();
    }

    function test_Withdraw_RevertsFromNonOwner() public {
        // fund so it doesn't revert on balance check first
        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        board.withdraw();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. setFee — happy path
    // ═══════════════════════════════════════════════════════════════════════

    function test_SetFee_UpdatesFee() public {
        uint256 newFee = 500_000; // 0.50 USDC
        vm.prank(owner);
        board.setFee(newFee);
        assertEq(board.fee(), newFee);
    }

    function test_SetFee_AllowsZeroFee() public {
        vm.prank(owner);
        board.setFee(0);
        assertEq(board.fee(), 0);
    }

    // ── setFee: revert path ──────────────────────────────────────────────────
    function test_SetFee_RevertsFromNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        board.setFee(999_999);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 7. EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_Event_ScoreSubmitted() public {
        vm.warp(2_000);
        vm.prank(alice);
        // topic1 = tokenCA, topic2 = alice, data = total + timestamp
        vm.expectEmit(true, true, false, true, address(board));
        emit TokenKarnesi.ScoreSubmitted(TOKEN_CA, alice, 0, uint64(2_000));
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);
    }

    function test_Event_Withdrawn() public {
        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(board));
        emit TokenKarnesi.Withdrawn(owner, INITIAL_FEE);
        board.withdraw();
    }

    function test_Event_FeeUpdated() public {
        uint256 newFee = 250_000;
        vm.prank(owner);
        vm.expectEmit(false, false, false, true, address(board));
        emit TokenKarnesi.FeeUpdated(INITIAL_FEE, newFee);
        board.setFee(newFee);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 8. FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @dev Any valid fee can be set and read back.
    function testFuzz_SetFee_AnyAmount(uint256 newFee) public {
        vm.prank(owner);
        board.setFee(newFee);
        assertEq(board.fee(), newFee, "fee not stored");
    }

    /// @dev submitScore with a fuzz-valid total (0–12) succeeds;
    ///      ensures the record is stored correctly.
    function testFuzz_SubmitScore_ValidTotal(uint8 total) public {
        total = uint8(bound(uint256(total), 0, 12));
        vm.prank(alice);
        board.submitScore(TOKEN_CA, ZERO_SCORES, total);
        assertEq(board.getScore(TOKEN_CA).total, total, "total mismatch");
    }

    /// @dev submitScore with total > 12 ALWAYS reverts.
    function testFuzz_SubmitScore_InvalidTotal_AlwaysReverts(uint8 total) public {
        total = uint8(bound(uint256(total), 13, 255));
        vm.prank(alice);
        vm.expectRevert(TokenKarnesi.InvalidTotal.selector);
        board.submitScore(TOKEN_CA, ZERO_SCORES, total);
    }

    /// @dev scoreValues[i] > 1 at any index ALWAYS reverts.
    function testFuzz_SubmitScore_InvalidScoreValue_AlwaysReverts(uint8 badVal, uint8 idx) public {
        badVal = uint8(bound(uint256(badVal), 2, 255));
        idx    = uint8(bound(uint256(idx), 0, 11));

        uint8[12] memory scores;
        scores[idx] = badVal;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TokenKarnesi.InvalidScoreValue.selector, uint256(idx)));
        board.submitScore(TOKEN_CA, scores, 0);
    }

    /// @dev After submitScore the fee is exactly deducted from caller.
    function testFuzz_SubmitScore_FeeDeducted(uint256 extraFunds) public {
        extraFunds = bound(extraFunds, 0, 1_000_000e6); // up to 1M USDC
        address user = makeAddr("fuzzUser");
        uint256 userFunds = INITIAL_FEE + extraFunds;

        usdc.mint(user, userFunds);
        vm.prank(user);
        usdc.approve(address(board), type(uint256).max);

        vm.prank(user);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        assertEq(usdc.balanceOf(user), extraFunds, "wrong balance after fee");
    }

    /// @dev setFee → submitScore uses the new fee amount.
    function testFuzz_SetFee_NewFeeUsedOnSubmit(uint256 newFee) public {
        newFee = bound(newFee, 1, 10_000_000); // 1 unit to 10 USDC

        vm.prank(owner);
        board.setFee(newFee);

        address user = makeAddr("fuzzUser2");
        usdc.mint(user, newFee);
        vm.prank(user);
        usdc.approve(address(board), newFee);

        vm.prank(user);
        board.submitScore(TOKEN_CA, ZERO_SCORES, 0);

        assertEq(usdc.balanceOf(address(board)), newFee, "contract balance mismatch");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant test contract (separate so forge can target it correctly)
// ─────────────────────────────────────────────────────────────────────────────
contract TokenKarnesiInvariantTest is Test {
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    TokenKarnesi          internal board;
    MockERC20             internal usdc;
    TokenKarnesiHandler   internal handler;

    address internal owner = makeAddr("inv-owner");
    address internal alice = makeAddr("inv-alice");

    function setUp() public {
        MockERC20 mockDeploy = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.etch(USDC_ADDR, address(mockDeploy).code);
        usdc = MockERC20(USDC_ADDR);

        board   = new TokenKarnesi(USDC_ADDR, 100_000, owner);
        handler = new TokenKarnesiHandler(board, usdc, owner, alice);

        // Constrain invariant fuzzer to only call handler functions.
        targetContract(address(handler));
    }

    /// @dev The contract's USDC balance always equals
    ///      totalDeposited - totalWithdrawn (no leakage or creation of funds).
    function invariant_ContractBalanceEqualsDepositsMinusWithdrawals() public view {
        uint256 contractBal = usdc.balanceOf(address(board));
        uint256 expected    = handler.totalDeposited() - handler.totalWithdrawn();
        assertEq(contractBal, expected, "invariant: balance accounting broken");
    }

    /// @dev Contract USDC balance is never negative (trivially true for uint256
    ///      but validates the accounting separately).
    function invariant_ContractBalanceNeverNegative() public view {
        // uint256 can't be negative; this asserts the handler math is consistent.
        assertGe(handler.totalDeposited(), handler.totalWithdrawn(), "withdrawn > deposited");
    }
}
