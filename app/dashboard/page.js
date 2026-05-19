'use client';
import { useState } from 'react';
import { ethers } from 'ethers';

// Tạm thời để trống địa chỉ contract, bước sau chúng ta điền vào sau
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
const CONTRACT_ABI = [
  "function buyTicket() public",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayersCount() public view returns (uint256)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [contract, setContract] = useState(null);
  const [winner, setWinner] = useState('Chưa có');
  const [playerCount, setPlayerCount] = useState(0);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);
        const lottoContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(lottoContract);
        const count = await lottoContract.getPlayersCount();
        setPlayerCount(Number(count));
      } catch (err) { alert('Kết nối ví thất bại!'); }
    } else { alert('Vui lòng cài MetaMask!'); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-3xl font-extrabold mb-2 text-blue-400">Arc Lottery 🔵</h1>
        <p className="text-sm text-slate-400 mb-6">Xổ Số Minh Bạch Trên Arc Network</p>
        <button onClick={connectWallet} className="bg-blue-600 hover:bg-blue-700 font-semibold py-3 px-6 rounded-xl w-full mb-6">
          {wallet ? `Ví: ${wallet.substring(0,6)}...` : 'Kết nối ví MetaMask'}
        </button>
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-left mb-4">
          <h3 className="font-bold text-emerald-400 mb-1">🎫 Mua Vé Số</h3>
          <p className="text-xs text-slate-400 mb-3">Số vé đã bán: <span className="text-white font-bold">{playerCount} vé</span></p>
          <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm">Mua ngay (1 USDC)</button>
        </div>
      </div>
    </div>
  );
}