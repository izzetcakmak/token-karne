// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TokenKarnesi
/// @notice 0.10 USDC ödeyerek bir token adresi için 12 soruluk karne skoru zincire kaydet.
contract TokenKarnesi is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Struct ───────────────────────────────────────────────────────────────

    struct ScoreRecord {
        address submitter;   // skoru gönderen adres
        uint8[12] scores;    // her sorunun cevabı (0 veya 1)
        uint8 total;         // toplam puan (0-12)
        uint64 timestamp;    // blok zamanı
    }

    // ─── Custom Errors ────────────────────────────────────────────────────────

    error InvalidTokenAddress();
    error InvalidTotal();
    error InvalidScoreValue(uint256 index);
    error InsufficientBalance();
    error ZeroAddress();

    // ─── Events ───────────────────────────────────────────────────────────────

    event ScoreSubmitted(address indexed tokenCA, address indexed submitter, uint8 total, uint64 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    uint256 public fee;
    mapping(address => ScoreRecord) public scores;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc, uint256 _initialFee, address _initialOwner)
        Ownable(_initialOwner)
    {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_initialOwner == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        fee  = _initialFee;
    }

    // ─── Write Functions ──────────────────────────────────────────────────────

    /// @notice USDC ödeyerek bir token için karne skoru kaydet.
    /// @param tokenCA   Analiz edilen token'ın kontrat adresi
    /// @param _scores   12 sorunun her biri için 0 veya 1
    /// @param _total    Toplam puan (0-12)
    function submitScore(
        address tokenCA,
        uint8[12] calldata _scores,
        uint8 _total
    ) external nonReentrant {
        if (tokenCA == address(0)) revert InvalidTokenAddress();
        if (_total > 12)           revert InvalidTotal();

        for (uint256 i = 0; i < 12; ++i) {
            if (_scores[i] > 1) revert InvalidScoreValue(i);
        }

        // Interaction önce — nonReentrant korur
        usdc.safeTransferFrom(msg.sender, address(this), fee);

        uint64 submittedAt = uint64(block.timestamp);
        scores[tokenCA] = ScoreRecord({
            submitter: msg.sender,
            scores:    _scores,
            total:     _total,
            timestamp: submittedAt
        });

        emit ScoreSubmitted(tokenCA, msg.sender, _total, submittedAt);
    }

    /// @notice Birikmiş USDC'yi owner'a çek.
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();

        address recipient = owner();
        usdc.safeTransfer(recipient, balance);

        emit Withdrawn(recipient, balance);
    }

    /// @notice Skor gönderme ücretini güncelle.
    function setFee(uint256 newFee) external onlyOwner {
        emit FeeUpdated(fee, newFee);
        fee = newFee;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Bir token için en son kaydedilen skoru döner.
    function getScore(address tokenCA) external view returns (ScoreRecord memory) {
        return scores[tokenCA];
    }
}
