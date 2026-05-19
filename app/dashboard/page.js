'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';


const CONTRACT_ADDRESS = "0x9fb18feB763EAE173951fEB8930CC929008Ed77a";

const CONTRACT_ABI = [
  "function buyTicket() public payable",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayers() public view returns (address[])",
  "function getPoolBalance() public view returns (uint256)",
  "function lastDrawTime() public view returns (uint256)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [contract, setContract] = useState(null);
  const [activeTab, setActiveTab] = useState('classic');
  const [loading, setLoading] = useState(false);

  // Dữ liệu minh bạch
  const [poolBalance, setPoolBalance] = useState('0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('Chưa có');
  const [timeLeft, setTimeLeft] = useState('Đang tải...');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);

        const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(lotto);
        updateData(lotto);
      } catch (err) { alert('Kết nối thất bại!'); }
    } else { alert('Vui lòng cài MetaMask!'); }
  };

  const updateData = async (lotto) => {
    try {
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      
      const pList = await lotto.getPlayers();
      setPlayersList(pList);
      
      const lastW = await lotto.recentWinner();
      if(lastW !== "0x0000000000000000000000000000000000000000") setWinner(lastW);

      // Tính toán đồng hồ đếm ngược minh bạch
      const lastTime = await lotto.lastDrawTime();
      const nextDrawTime = Number(lastTime) + 3600; // Cộng thêm 1 tiếng (3600 giây)
      
      const interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const diff = nextDrawTime - now;
        if (diff <= 0) {
          setTimeLeft("SẴN SÀNG QUAY THƯỞNG!");
          clearInterval(interval);
        } else {
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          setTimeLeft(`${m} phút ${s} giây`);
        }
      }, 1000);
    } catch (err) { console.error(err); }
  };

  const buyTicket = async () => {
    if (!contract) return alert('Hãy kết nối ví!');
    setLoading(true);
    try {
      const tx = await contract.buyTicket({ value: ethers.parseEther("0.1") });
      await tx.wait();
      alert('Đã chốt vé 0.1 USDC thành công!');
      updateData(contract);
    } catch (err) { alert('Giao dịch lỗi! Kiểm tra lại số dư USDC.'); }
    setLoading(false);
  };

  const drawLottery = async () => {
    if (!contract) return alert('Hãy kết nối ví!');
    setLoading(true);
    try {
      const tx = await contract.drawLottery();
      await tx.wait();
      alert('Đã xổ số xong! Hệ thống đã tự động gửi USDC cho người thắng.');
      updateData(contract);
    } catch (err) { alert('Chưa hết giờ hoặc chưa có ai mua vé!'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-3">ARC GRAND CASINO</h1>
          <p className="text-slate-400 text-lg">Hệ Sinh Thái Xổ Số Minh Bạch 100%</p>
        </div>

        {/* Nút Kết nối ví */}
        <div className="flex justify-end mb-6">
          <button onClick={connectWallet} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 py-3 px-6 rounded-xl font-mono shadow-lg transition">
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Kết Nối Ví MetaMask'}
          </button>
        </div>

        {/* Thanh Điều Hướng Chế Độ Chơi */}
        <div className="flex gap-2 p-1 bg-slate-800/80 rounded-2xl mb-6">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>⏱️ Theo Giờ</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'mega' ? 'bg-slate-600 text-white cursor-not-allowed' : 'text-slate-500 cursor-not-allowed'}`}>🎯 Mega 6/45 (Sắp ra mắt)</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'scratch' ? 'bg-slate-600 text-white cursor-not-allowed' : 'text-slate-500 cursor-not-allowed'}`}>🎟️ Cào Liền (Sắp ra mắt)</button>
        </div>

        {/* MÀN HÌNH CHƠI CLASSIC CÔNG KHAI */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cột trái: Mua vé & Đồng hồ */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">Arc Classic (0.1 USDC/Vé)</h2>
              
              <div className="bg-slate-900 rounded-2xl p-4 mb-6 border border-slate-700 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest">Thời Gian Xổ Tiếp Theo</p>
                <div className="text-2xl font-black text-amber-400 font-mono animate-pulse">{timeLeft}</div>
              </div>

              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 mb-6 text-center">
                <p className="text-slate-400 text-sm mb-2">Tổng Giải Thưởng Hiện Tại</p>
                <div className="text-4xl font-black text-emerald-400">{poolBalance} USDC</div>
              </div>

              <button onClick={buyTicket} disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 mb-4">
                {loading ? "Đang xử lý..." : "MUA VÉ NGAY"}
              </button>

              <button onClick={drawLottery} disabled={loading} className="w-full bg-slate-700 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all text-sm border border-slate-600">
                 KÍCH HOẠT XỔ SỐ KHI HẾT GIỜ
              </button>
            </div>

            {/* Cột phải: Bảng Phong Thần Minh Bạch */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col">
              <h2 className="text-xl font-bold text-fuchsia-400 mb-4">Bảng Minh Bạch</h2>
              
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-2 uppercase font-bold">👑 Lịch Sử Trúng Giải:</p>
                <div className="bg-slate-900 p-3 rounded-xl font-mono text-xs text-amber-400 border border-slate-700 truncate">
                  {winner}
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-2 uppercase font-bold">🎫 Danh Sách Vé Lượt Này ({playersList.length}):</p>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex-1 overflow-y-auto max-h-[250px] space-y-2">
                {playersList.length === 0 ? (
                  <p className="text-slate-500 text-sm italic text-center mt-4">Chưa có ai mua vé lượt này.</p>
                ) : (
                  playersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-slate-800 p-2 rounded text-xs font-mono">
                      <span className="text-slate-400">Vé #{index + 1}</span>
                      <span className="text-cyan-300">{player.substring(0,8)}...{player.substring(36)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}