// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcCasino {
    address[] public players;           // Danh sách ví tham gia lượt này
    address public recentWinner;        // Người trúng giải lượt trước
    uint256 public lastDrawTime;        // Mốc thời gian lần xổ trước
    uint256 public constant DRAW_INTERVAL = 1 hours; // Khóa thời gian đúng 1 tiếng
    uint256 public constant TICKET_PRICE = 1 ether;  // Giá vé 1 USDC (Mạng Arc quy ước 1 token gốc = 1 ether)

    event TicketPurchased(address indexed player, uint256 amount);
    event WinnerPicked(address indexed winner, uint256 prizeAmount);

    constructor() {
        lastDrawTime = block.timestamp; // Khởi tạo thời gian bắt đầu game
    }

    // Hàm mua vé số - Tiền USDC của người chơi sẽ chạy thẳng vào Pool của Contract
    function buyTicket() public payable {
        require(msg.value == TICKET_PRICE, "Ban can gui dung 1 USDC de mua ve!");
        players.push(msg.sender);
        emit TicketPurchased(msg.sender, msg.value);
    }

    // Hàm quay số trúng thưởng và tự động rải tiền từ Pool về ví người trúng
    function drawLottery() public {
        require(block.timestamp >= lastDrawTime + DRAW_INTERVAL, "Chua den gio xo so! Vui long doi du 1 tieng.");
        require(players.length > 0, "Khong co ai mua ve trong luot nay, khong the xo!");

        // Thuật toán tạo số ngẫu nhiên minh bạch từ dữ liệu blockchain
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, players))) % players.length;
        recentWinner = players[randomIndex];

        // Tính toán tổng số tiền trong Pool thưởng hiện tại để chuyển đi
        uint256 poolPrize = address(this).balance;
        
        // Thực hiện chuyển thẳng toàn bộ tiền USDC trong két cho người trúng giải
        (bool success, ) = recentWinner.call{value: poolPrize}("");
        require(success, "Chuyen tien thuong that bai!");

        emit WinnerPicked(recentWinner, poolPrize);

        // Reset két và danh sách ví để bắt đầu lượt chơi của giờ tiếp theo
        delete players;
        lastDrawTime = block.timestamp;
        payable(msg.sender).transfer(address(this).balance);
    }

    // Hàm xem số lượng người đã mua vé trong giờ này
    function getPlayersCount() public view returns (uint256) {
        return players.length;
    }

    // Hàm kiểm tra xem trong Pool hiện tại đang tích lũy được bao nhiêu USDC thưởng
    function getPoolBalance() public view returns (uint256) {
        return address(this).balance;
    }
}