'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';


const CONTRACT_ADDRESS = "0x6821c82b5Aa026b9DE38cb7C51b6774Eb6f4732e";

const CONTRACT_ABI = [
  "function buyTicket() public payable",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayersCount() public view returns (uint256)",
  "function getPoolBalance() public view returns (uint256)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [contract, setContract] = useState(null);
  const [winner, setWinner] = useState('Chưa có');
  const [playerCount, setPlayerCount] = useState(0);
  const [poolBalance, setPoolBalance] = useState('0');
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);

        const lottoContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(lottoContract);
        updateData(lottoContract);
      } catch (err) { alert('Kết nối thất bại!'); }
    } else { alert('Vui lòng cài MetaMask!'); }
  };

  const updateData = async (lotto) => {
    try {
      const count = await lotto.getPlayersCount();
      setPlayerCount(Number(count));
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      const lastW = await lotto.recentWinner();
      if(lastW !== "0x0000000000000000000000000000000000000000") setWinner(lastW);
    } catch (err) { console.error(err); }
  };

  const buyTicket = async () => {
    if (!contract) return alert('Hãy kết nối ví!');
    setLoading(true);
    try {
      // ĐÃ SỬA: Chỉ trừ đúng 0.1 USDC để bạn không bị phá sản
      const tx = await contract.buyTicket({ value: ethers.parseEther("0.1") });
      await tx.wait();
      alert('Mua vé thành công với giá 0.1 USDC!');
      updateData(contract);
    } catch (err) { alert('Lỗi: Bạn có đủ 0.1 USDC Testnet không?'); }
    setLoading(false);
  };

  const drawLottery = async () => {
    if (!contract) return alert('Hãy kết nối ví!');
    setLoading(true);
    try {
      const tx = await contract.drawLottery();
      await tx.wait();
      alert('Đã xổ số! Tiền thưởng đã được gửi đi.');
      updateData(contract);
    } catch (err) { alert('Chưa đến giờ hoặc không có ai mua vé!'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-br from-cyan-400 to-blue-600 bg-clip-text text-transparent italic">ARC CASINO V2</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium uppercase tracking-widest">Mạng Lưới Xổ Số Minh Bạch</p>
        </div>

        <button onClick={connectWallet} className="w-full bg-slate-800/50 hover:bg-slate-800 py-3 rounded-2xl text-sm font-mono border border-slate-700 transition mb-8 truncate px-4">
          {wallet ? `VÍ: ${wallet}` : '🔌 KẾT NỐI VÍ METAMASK'}
        </button>

        <div className="space-y-6">
          <div className="bg-slate-950 p-6 rounded-[24px] border border-slate-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-bl-xl">LIVE</div>
             <p className="text-slate-400 text-xs uppercase font-bold mb-1">Pool Thưởng Hiện Tại</p>
             <div className="text-3xl font-black text-emerald-400 mb-4">{poolBalance} <span className="text-sm">USDC</span></div>
             <p className="text-xs text-slate-500 mb-4 italic">Số vé đã bán: {playerCount} vé</p>
             <button onClick={buyTicket} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 py-4 rounded-xl font-black shadow-lg shadow-cyan-900/20 active:scale-95 transition">
               MUA VÉ (0.1 USDC)
             </button>
          </div>

          <div className="bg-slate-950 p-6 rounded-[24px] border border-slate-800">
             <p className="text-slate-400 text-xs uppercase font-bold mb-1">Xổ Số Sau Mỗi 1 Giờ</p>
             <p className="text-[10px] text-slate-500 font-mono mb-4 truncate italic">Winner: {winner}</p>
             <button onClick={drawLottery} disabled={loading} className="w-full bg-slate-800 hover:bg-amber-600 py-3 rounded-xl font-bold transition text-sm">
               {loading ? "ĐANG XỬ LÝ..." : "KÍCH HOẠT QUAY SỐ"}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}