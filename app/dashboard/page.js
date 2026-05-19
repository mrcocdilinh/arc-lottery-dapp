'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xE0F2C50E2F2A6F91A02De6d9C398088113d9f5B0";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";

const CONTRACT_ABI = [
  "function buyTickets(uint256 numberOfTickets) public payable",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayers() public view returns (address[])",
  "function getPoolBalance() public view returns (uint256)",
  "function lastDrawTime() public view returns (uint256)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [signerInstance, setSignerInstance] = useState(null);
  const [activeTab, setActiveTab] = useState('buy'); // 'buy', 'history', 'my-tickets'
  const [loading, setLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Dữ liệu Blockchain
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [timeLeft, setTimeLeft] = useState('Đang đồng bộ...');

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
        const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        const balance = await lotto.getPoolBalance();
        setPoolBalance(ethers.formatEther(balance));
        
        const pList = await lotto.getPlayers();
        setPlayersList(pList);
        
        const lastW = await lotto.recentWinner();
        if (lastW !== "0x0000000000000000000000000000000000000000") {
          setWinner(lastW);
        }

        const lastTime = await lotto.lastDrawTime();
        const nextDrawTime = Number(lastTime) + 3600; 
        
        const timer = setInterval(() => {
          const now = Math.floor(Date.now() / 1000);
          const diff = nextDrawTime - now;
          if (diff <= 0) {
            setTimeLeft("SẴN SÀNG QUAY THƯỞNG!");
            clearInterval(timer);
          } else {
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            setTimeLeft(`${m} phút ${s} giây`);
          }
        }, 1000);

        return () => clearInterval(timer);
      } catch (err) {
        setTimeLeft("Lỗi đồng bộ RPC");
      }
    };
    fetchPublicData();
  }, []);

  // Thuật toán nhận diện đa ví chuyên sâu
  const connectWallet = async (walletType) => {
    let targetProvider = null;

    if (typeof window !== 'undefined') {
      if (walletType === 'okx' && window.okxwallet) {
        targetProvider = window.okxwallet;
      } else if (walletType === 'binance' && window.BinanceChain) {
        targetProvider = window.BinanceChain;
      } else if (walletType === 'trust' && window.trustwallet) {
        targetProvider = window.trustwallet;
      } else if (window.ethereum) {
        // Fallback cho MetaMask, Zerion, Rabby,...
        targetProvider = window.ethereum;
      }
    }

    if (!targetProvider) {
      alert(`Không tìm thấy tiện ích ví này! Vui lòng cài đặt extension.`);
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(targetProvider);
      await targetProvider.request({ method: 'eth_requestAccounts' });
      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(address);
      setSignerInstance(signer);
      setShowWalletModal(false);
      
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      const pList = await lotto.getPlayers();
      setPlayersList(pList);
    } catch (err) {
      alert('Kết nối bị hủy hoặc xảy ra lỗi từ phía ví!');
    }
  };

  const handleBuyTickets = async () => {
    if (!signerInstance) return alert('Vui lòng kết nối ví trước!');
    if (ticketCount < 1) return alert('Số lượng vé tối thiểu là 1');

    setLoading(true);
    try {
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const costPerTicket = 0.1;
      const totalCost = (costPerTicket * ticketCount).toFixed(1);
      
      const tx = await lotto.buyTickets(ticketCount, {
        value: ethers.parseEther(totalCost.toString())
      });
      await tx.wait();
      
      alert(`Thành công! Đã mua ${ticketCount} vé.`);
      window.location.reload(); 
    } catch (err) {
      alert('Giao dịch thất bại. Hãy kiểm tra số dư USDC hoặc mạng lưới.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrawLottery = async () => {
    if (!signerInstance) return alert('Vui lòng kết nối ví trước!');
    setLoading(true);
    try {
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const tx = await lotto.drawLottery();
      await tx.wait();
      alert('Đã quay thưởng xong! Hợp đồng tự động giải ngân.');
      window.location.reload();
    } catch (err) {
      alert('Chưa đến giờ xổ số hoặc chưa có ai mua vé.');
    } finally {
      setLoading(false);
    }
  };

  // Lọc vé của người dùng hiện tại
  const myTicketIndexes = playersList
    .map((p, index) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? index + 1 : null))
    .filter(index => index !== null);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        
        {/* Header App */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2 tracking-tight">
            ARC GRAND CASINO
          </h1>
          <p className="text-slate-500 text-sm font-semibold tracking-widest uppercase">
            Hệ sinh thái Xổ số On-Chain Đa nền tảng
          </p>
        </div>

        {/* Nút Kết Nối Ví Dynamic */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={() => wallet ? setWallet('') : setShowWalletModal(true)} 
            className="bg-[#0f172a] hover:bg-[#1e293b] border border-slate-700/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl transition-all font-bold flex items-center gap-2"
          >
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Kết Nối Ví Web3'}
          </button>
        </div>

        {/* Thanh Điều Hướng Chức Năng */}
        <div className="flex gap-2 p-1.5 bg-[#0f172a]/80 border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
          <button onClick={() => setActiveTab('buy')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'buy' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🛒 MUA VÉ</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>📜 LỊCH SỬ CHUNG</button>
          <button onClick={() => setActiveTab('my-tickets')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'my-tickets' ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎫 VÉ CỦA TÔI</button>
        </div>

        {/* KHU VỰC 1: MUA VÉ */}
        {activeTab === 'buy' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 mb-1">Arc Classic</h2>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-6">Đơn giá: 0.1 USDC / Vé</p>
                
                <div className="bg-[#05080f] border border-slate-800/50 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Thời gian xổ vòng tiếp theo</p>
                  <div className="text-3xl font-black text-amber-400 font-mono tracking-wider">{timeLeft}</div>
                </div>

                <div className="bg-gradient-to-b from-teal-950/20 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 mb-6 text-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Tổng Két Thưởng (Pool)</p>
                  <div className="text-4xl font-black text-emerald-400 tracking-tight">{poolBalance} <span className="text-lg font-medium">USDC</span></div>
                </div>

                <div className="flex items-center gap-4 bg-[#05080f] p-3 rounded-xl border border-slate-800 mb-6">
                  <span className="text-slate-400 text-xs font-bold uppercase pl-2">Số lượng mua:</span>
                  <input 
                    type="number" min="1" value={ticketCount} 
                    onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-transparent text-white font-black text-xl text-right flex-1 outline-none pr-2"
                  />
                </div>
              </div>

              <div>
                <button 
                  onClick={handleBuyTickets} disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-xl shadow-cyan-950/50 transition-all transform hover:scale-[1.02] active:scale-[0.98] mb-3 text-sm tracking-wider"
                >
                  {loading ? "ĐANG XỬ LÝ GIAO DỊCH..." : `CHỐT MUA NGAY (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button 
                  onClick={handleDrawLottery} disabled={loading}
                  className="w-full bg-transparent border border-slate-700 hover:bg-slate-800 font-bold py-3 rounded-xl transition-all text-xs tracking-wide text-amber-400"
                >
                  KÍCH HOẠT VÒNG QUAY SỐ
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col items-center justify-center text-center">
               <div className="text-7xl mb-4">🎰</div>
               <h3 className="text-xl font-bold text-slate-300 mb-2">Minh bạch 100% bằng Smart Contract</h3>
               <p className="text-slate-500 text-sm">Toàn bộ thuật toán quay số và kết quả đều được xử lý on-chain, loại bỏ hoàn toàn rủi ro can thiệp kết quả từ chủ sàn.</p>
            </div>
          </div>
        )}

        {/* KHU VỰC 2: LỊCH SỬ CHUNG TOÀN MẠNG */}
        {activeTab === 'history' && (
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-fuchsia-400">Bảng Phong Thần Toàn Mạng</h2>
              <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400">Tổng: {playersList.length} vé</span>
            </div>
            
            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
              <p className="text-amber-500/80 text-xs uppercase font-black mb-1 tracking-wide">👑 Người trúng vòng trước:</p>
              <div className="font-mono text-sm text-amber-400 break-all">{winner}</div>
            </div>

            <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Danh sách vé đã bán vòng này:</p>
            <div className="bg-[#05080f] border border-slate-800/80 rounded-2xl p-4 overflow-y-auto max-h-[400px] space-y-2">
              {playersList.length === 0 ? (
                <p className="text-slate-600 text-sm italic text-center mt-10 mb-10">Chưa có giao dịch mua vé nào trong vòng này.</p>
              ) : (
                playersList.map((player, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/50 hover:border-slate-600 transition-colors">
                    <span className="text-slate-400 text-sm font-bold mb-1 sm:mb-0">Mã vé: #{index + 1}</span>
                    <span className="text-cyan-400 font-mono text-xs sm:text-sm break-all">{player}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* KHU VỰC 3: LỊCH SỬ CÁ NHÂN CỦA USER */}
        {activeTab === 'my-tickets' && (
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-emerald-400 mb-2">Kho Vé Của Bạn</h2>
            <p className="text-slate-500 text-sm mb-6">Theo dõi các mã vé bạn đã mua trong vòng hiện tại.</p>

            {!wallet ? (
              <div className="bg-[#05080f] p-10 rounded-2xl border border-slate-800 text-center">
                <p className="text-slate-400 mb-4">Vui lòng kết nối ví để xem lịch sử mua vé.</p>
                <button onClick={() => setShowWalletModal(true)} className="bg-emerald-500 text-slate-900 font-bold py-2 px-6 rounded-lg">Kết Nối Ngay</button>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase">Tổng số vé đang sở hữu</p>
                    <p className="text-3xl font-black text-white">{myTicketIndexes.length}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase">Tỉ lệ trúng thưởng</p>
                    <p className="text-3xl font-black text-emerald-400">
                      {playersList.length > 0 ? ((myTicketIndexes.length / playersList.length) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Mã số dự thưởng của bạn:</p>
                {myTicketIndexes.length === 0 ? (
                  <div className="bg-[#05080f] p-8 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 italic">Bạn chưa sở hữu vé nào trong vòng này.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {myTicketIndexes.map(idx => (
                      <div key={idx} className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 py-3 rounded-xl text-center font-black text-emerald-400 font-mono shadow-inner">
                        #{idx}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Cửa sổ Popup Đa Ví */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Chọn Ví Kết Nối</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-500 hover:text-white font-bold text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <button onClick={() => connectWallet('okx')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">
                <span className="text-2xl">⬛</span> OKX Wallet
              </button>
              <button onClick={() => connectWallet('binance')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">
                <span className="text-2xl">🔶</span> Binance Web3 Wallet
              </button>
              <button onClick={() => connectWallet('trust')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">
                <span className="text-2xl">🛡️</span> Trust Wallet
              </button>
              <button onClick={() => connectWallet('browser')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">
                <span className="text-2xl">🦊</span> MetaMask / Zerion / Rabby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}