'use client';
import { useState } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Tạm thời để trống
const CONTRACT_ABI = ["function getPlayersCount() public view returns (uint256)"];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [activeTab, setActiveTab] = useState('classic');
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  // Hàm kết nối ví đã được tối ưu chống lỗi
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);
        
        // Nếu đã có contract thật thì mới gọi dữ liệu
        if (CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
            const lottoContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            await lottoContract.getPlayersCount();
        }
      } catch (err) { alert('Lỗi khi tải dữ liệu từ Blockchain!'); }
    } else { alert('Vui lòng cài tiện ích ví MetaMask!'); }
  };

  // Logic chọn số Vietlott (chọn tối đa 6 số)
  const toggleNumber = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans selection:bg-fuchsia-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Siêu Cấp */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-3 tracking-tight">
            ARC GRAND CASINO
          </h1>
          <p className="text-slate-400 text-lg">Mạng Lưới Xổ Số Đa Thể Thức Nhanh Nhất Web3</p>
        </div>

        {/* Khu vực ví và Thông tin */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Trạng thái kết nối</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${wallet ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></div>
              <span className="font-mono font-medium">{wallet ? `${wallet.substring(0,8)}...${wallet.substring(36)}` : 'Chưa kết nối ví'}</span>
            </div>
          </div>
          <button 
            onClick={connectWallet}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95"
          >
            {wallet ? 'Đã Kết Nối' : '🔌 Kết Nối MetaMask'}
          </button>
        </div>

        {/* Thanh Điều Hướng Chế Độ Chơi */}
        <div className="flex gap-2 p-1 bg-slate-800/80 rounded-2xl mb-6">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>⏱️ Theo Giờ</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'mega' ? 'bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>🎯 Mega 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'scratch' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>🎟️ Cào Liền</button>
        </div>

        {/* MÀN HÌNH CHƠI */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-3xl p-6 min-h-[400px]">
          
          {/* TAB 1: CLASSIC (Theo giờ) */}
          {activeTab === 'classic' && (
            <div className="text-center animate-fade-in">
              <h2 className="text-2xl font-bold text-cyan-400 mb-2">Arc Classic</h2>
              <p className="text-slate-400 mb-8">Xổ số tự động minh bạch mỗi 1 giờ đồng hồ.</p>
              <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700 max-w-sm mx-auto">
                <div className="text-6xl mb-4">🎫</div>
                <div className="text-xl font-mono text-slate-300 mb-6">Giải thưởng: <span className="text-emerald-400 font-bold text-2xl">500 USDC</span></div>
                <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all">Mua Vé (1 USDC)</button>
              </div>
            </div>
          )}

          {/* TAB 2: MEGA 6/45 (Vietlott) */}
          {activeTab === 'mega' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-fuchsia-400 mb-2">Mega 6/45 Blockchain</h2>
                <p className="text-slate-400">Chọn 6 con số may mắn. Trúng Jackpot đổi đời.</p>
              </div>
              
              <div className="grid grid-cols-5 md:grid-cols-9 gap-2 mb-6">
                {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                  <button 
                    key={num}
                    onClick={() => toggleNumber(num)}
                    className={`aspect-square rounded-full font-bold text-lg flex items-center justify-center transition-all transform hover:scale-110 ${selectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/50 scale-110' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-400">Số đã chọn ({selectedNumbers.length}/6):</p>
                  <div className="text-xl font-mono text-fuchsia-300 font-bold tracking-widest mt-1">
                    {selectedNumbers.length > 0 ? selectedNumbers.sort((a,b)=>a-b).join(' - ') : 'Chưa chọn số'}
                  </div>
                </div>
                <button 
                  disabled={selectedNumbers.length !== 6}
                  className={`py-3 px-6 rounded-xl font-bold transition-all ${selectedNumbers.length === 6 ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                >
                  Chốt Vé (2 USDC)
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: THẺ CÀO */}
          {activeTab === 'scratch' && (
            <div className="text-center animate-fade-in">
              <h2 className="text-2xl font-bold text-amber-400 mb-2">Thẻ Cào May Mắn</h2>
              <p className="text-slate-400 mb-8">Biết kết quả ngay lập tức nhờ tốc độ Sub-second của Arc Network.</p>
              <div className="bg-gradient-to-br from-amber-300 to-orange-500 rounded-3xl p-1 max-w-sm mx-auto shadow-2xl shadow-orange-500/20 transform rotate-1 hover:rotate-0 transition-all duration-300">
                <div className="bg-slate-900 rounded-[22px] p-8 border-4 border-dashed border-amber-500/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                  <h3 className="text-3xl font-black text-amber-500 mb-6 uppercase tracking-wider">Cào Là Trúng</h3>
                  <button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-5 rounded-xl text-xl shadow-lg transition-all transform hover:scale-105">
                    CÀO NGAY (0.5 USDC)
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}