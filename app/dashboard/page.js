'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xE0F2C50E2F2A6F91A02De6d9C398088113d9f5B0";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4CEF52";

const CONTRACT_ABI = [
  "function buyTickets(uint256 numberOfTickets) public payable",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayers() public view returns (address[])",
  "function getPoolBalance() public view returns (uint256)",
  "function lastDrawTime() public view returns (uint256)",
  "event WinnerPicked(address indexed winner, uint256 prizeAmount)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [signerInstance, setSignerInstance] = useState(null);
  const [activeTab, setActiveTab] = useState('classic'); 
  const [loadingState, setLoadingState] = useState(''); 
  const [ticketCount, setTicketCount] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000);
  };

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [historicalWinners, setHistoricalWinners] = useState([]);
  const [nextDrawTime, setNextDrawTime] = useState(0);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const clock = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(clock);
  }, []);

  const diff = nextDrawTime - now;
  let timeLeft = "Syncing...";
  if (nextDrawTime > 0) {
    if (diff <= 0) {
      timeLeft = "READY TO DRAW!";
    } else {
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      timeLeft = `${m}m ${s}s`;
    }
  }

  const fetchPublicData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      
      const pList = await lotto.getPlayers();
      setPlayersList(pList);
      
      const lastW = await lotto.recentWinner();
      if (lastW !== "0x0000000000000000000000000000000000000000") setWinner(lastW);

      const lastTime = await lotto.lastDrawTime();
      setNextDrawTime(Number(lastTime) + 3600);

      try {
        const filter = lotto.filters.WinnerPicked();
        const events = await lotto.queryFilter(filter, -10000); 
        const historyData = events.map((event, index) => ({
          round: index + 1,
          winner: event.args[0],
          prize: ethers.formatEther(event.args[1])
        })).reverse();
        setHistoricalWinners(historyData);
      } catch (logErr) { console.error("Log fetch error:", logErr); }
    } catch (err) { console.error("Public Data Error:", err); }
  };

  useEffect(() => {
    fetchPublicData();
    const autoReconnect = async () => {
      const savedWalletType = localStorage.getItem('connectedWalletType');
      if (!savedWalletType || typeof window === 'undefined') return;

      let targetProvider = null;
      if (savedWalletType === 'okx' && window.okxwallet) targetProvider = window.okxwallet;
      else if (savedWalletType === 'binance' && window.BinanceChain) targetProvider = window.BinanceChain;
      else if (savedWalletType === 'trust' && window.trustwallet) targetProvider = window.trustwallet;
      else if (window.ethereum) targetProvider = window.ethereum;

      if (targetProvider) {
        try {
          const accounts = await targetProvider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const browserProvider = new ethers.BrowserProvider(targetProvider);
            const signer = await browserProvider.getSigner();
            setWallet(accounts[0]);
            setSignerInstance(signer);
          } else { localStorage.removeItem('connectedWalletType'); }
        } catch (e) { console.error("Auto-reconnect failed", e); }
      }
    };
    setTimeout(autoReconnect, 500);
  }, []);

  const connectWallet = async (walletType) => {
    let targetProvider = null;
    if (typeof window !== 'undefined') {
      if (walletType === 'okx' && window.okxwallet) targetProvider = window.okxwallet;
      else if (walletType === 'binance' && window.BinanceChain) targetProvider = window.BinanceChain;
      else if (walletType === 'trust' && window.trustwallet) targetProvider = window.trustwallet;
      else if (window.ethereum) targetProvider = window.ethereum;
    }
    
    if (!targetProvider) return showToast("No Web3 wallet extension detected!", "error");

    try {
      await targetProvider.request({ method: 'eth_requestAccounts' });
      const browserProvider = new ethers.BrowserProvider(targetProvider);
      const network = await browserProvider.getNetwork();
      
      if (Number(network.chainId) !== ARC_CHAIN_ID) {
        try {
          await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX }] });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await targetProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: ARC_CHAIN_ID_HEX,
                chainName: 'Arc Testnet',
                rpcUrls: [ARC_RPC_URL],
                nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                blockExplorerUrls: ['https://explorer.testnet.arc.network'],
              }],
            });
          } else { throw switchError; }
        }
      }

      const updatedProvider = new ethers.BrowserProvider(targetProvider);
      const signer = await updatedProvider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(address);
      setSignerInstance(signer);
      setShowWalletModal(false);
      localStorage.setItem('connectedWalletType', walletType);
      
      await fetchPublicData();
      showToast("Wallet connected successfully!", "success");
    } catch (err) { showToast(`Error: ${err.message || 'Connection failed'}`, "error"); }
  };

  const handleBuyTickets = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    try {
      setLoadingState('Sign in Wallet...');
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const totalCost = (0.1 * ticketCount).toFixed(1);
      
      const tx = await lotto.buyTickets(ticketCount, { value: ethers.parseEther(totalCost.toString()) });
      
      setLoadingState('Mining Block...');
      await tx.wait(); 
      
      showToast(`Success! Purchased ${ticketCount} ticket(s).`, 'success');
      await fetchPublicData();
    } catch (err) {
      showToast('Transaction failed or rejected.', 'error');
    } finally { setLoadingState(''); }
  };

  const handleDrawLottery = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    try {
      setLoadingState('Sign to Draw...');
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const tx = await lotto.drawLottery();
      
      setLoadingState('Mining Block...');
      await tx.wait();
      
      const updatedLotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, new ethers.JsonRpcProvider(ARC_RPC_URL));
      const newWinner = await updatedLotto.recentWinner();
      
      if (newWinner.toLowerCase() === wallet.toLowerCase()) {
        showToast('🎉 JACKPOT! YOU WON! The prize has been sent directly to your wallet.', 'success');
      } else {
        showToast(`Draw Successful! The winner is ${newWinner.substring(0,8)}... Better luck next time!`, 'info');
      }

      await fetchPublicData();
    } catch (err) {
      showToast('Cannot Draw! Ensure timer is at 00:00 and players have bought tickets.', 'error');
    } finally { setLoadingState(''); }
  };

  const toggleMegaNumber = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  // Tính toán dữ liệu thống kê cá nhân
  const myTicketIndexes = playersList
    .map((p, index) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? index + 1 : null))
    .filter(index => index !== null);

  const myWins = historicalWinners.filter(h => wallet && h.winner.toLowerCase() === wallet.toLowerCase());
  const totalMyWinnings = myWins.reduce((acc, curr) => acc + parseFloat(curr.prize), 0);

  return (
    <div className="min-h-screen bg-[#050810] text-white p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      
      {/* Nền hiệu ứng ánh sáng (Ambient Glow) */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* TOAST NOTIFICATION */}
      {notification.show && (
        <div className="fixed top-8 left-0 right-0 flex justify-center z-[100] animate-fadeIn">
          <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 transition-all transform
            ${notification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 
              notification.type === 'error' ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 
              'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]'}`}>
            <div className="text-2xl drop-shadow-md">
              {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : '🔔'}
            </div>
            <p className="font-bold text-sm tracking-wide">{notification.message}</p>
            <button 
              onClick={() => setNotification({ show: false, message: '', type: '' })} 
              className="ml-4 opacity-50 hover:opacity-100 text-white transition-opacity"
            >✕</button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Header Rebranded */}
        <div className="text-center mb-10 mt-6">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-3 tracking-tighter drop-shadow-sm">
            ARC LOTTERY
          </h1>
          <p className="text-cyan-400/80 text-sm font-bold tracking-[0.3em] uppercase">
            Fair • Transparent • On-Chain
          </p>
        </div>

        {/* Connect button */}
        <div className="flex justify-end mb-8">
          {wallet ? (
            <div className="flex items-center gap-3">
              <button onClick={() => { navigator.clipboard.writeText(wallet); showToast("Address Copied to clipboard!", "success"); }} className="bg-[#0b1221] hover:bg-[#131d33] border border-cyan-900/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl font-bold text-cyan-400 hover:border-cyan-500/50 transition-all duration-300" title="Click to copy">
                <span className="mr-2 inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                {wallet.substring(0,6)}...{wallet.substring(38)}
              </button>
              <button onClick={() => { setWallet(''); setSignerInstance(null); localStorage.removeItem('connectedWalletType'); showToast("Logged out successfully.", "info"); }} className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 py-3 px-5 rounded-2xl font-bold text-sm transition-all shadow-xl">
                Log Out
              </button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 py-3 px-8 rounded-2xl font-mono text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] font-bold transition-all duration-300 transform hover:-translate-y-1">
              🔌 Connect Web3 Wallet
            </button>
          )}
        </div>

        {/* Modern Tabs */}
        <div className="flex gap-3 p-2 bg-[#0b1221]/80 backdrop-blur-md border border-slate-800/80 rounded-3xl mb-10 overflow-x-auto shadow-2xl">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${activeTab === 'classic' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'}`}>⏱️ CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${activeTab === 'mega' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.15)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'}`}>🎯 MEGA 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${activeTab === 'scratch' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'}`}>🎟️ SCRATCH CARDS</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${activeTab === 'ledger' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'}`}>📜 HISTORY & TICKETS</button>
        </div>

        {/* Tab 1: Classic Lottery */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            {/* Purchase Card */}
            <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 hover:border-cyan-500/30 transition-colors duration-500 rounded-[40px] p-8 shadow-2xl flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black text-white group-hover:text-cyan-400 transition-colors">Classic Draw</h2>
                  <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-full">0.1 USDC / Ticket</span>
                </div>
                
                <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-6 mb-6 flex flex-col items-center justify-center shadow-inner">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">Time until next draw</p>
                  <div className={`text-4xl font-black font-mono tracking-wider ${timeLeft === 'READY TO DRAW!' ? 'text-emerald-400 animate-pulse drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]'}`}>
                    {timeLeft}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/10 border border-emerald-500/30 rounded-3xl p-6 mb-6 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                  <p className="text-emerald-500/80 text-xs font-bold uppercase tracking-[0.2em] mb-2 relative z-10">Current Jackpot Pool</p>
                  <div className="text-5xl font-black text-emerald-400 tracking-tight drop-shadow-md relative z-10">{poolBalance} <span className="text-xl font-medium text-emerald-500/50">USDC</span></div>
                </div>

                <div className="flex items-center justify-between bg-[#050810] py-4 px-6 rounded-2xl border border-slate-800 mb-8">
                  <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Buy Quantity:</span>
                  <input 
                    type="number" min="1" value={ticketCount} 
                    onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-transparent text-white font-black text-3xl text-center w-24 outline-none focus:text-cyan-400 transition-colors"
                    style={{ appearance: 'textfield', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <button onClick={handleBuyTickets} disabled={!!loadingState} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-4 md:py-5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 transform hover:-translate-y-1 tracking-wider uppercase">
                  {loadingState ? loadingState : `Confirm Purchase (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button onClick={handleDrawLottery} disabled={!!loadingState} className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 text-sm tracking-[0.2em] uppercase ${timeLeft === "READY TO DRAW!" ? "bg-amber-500 text-[#050810] hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] transform hover:-translate-y-1" : "bg-transparent border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-400"}`}>
                  {timeLeft === "READY TO DRAW!" ? "🏆 Execute Draw & Payout Prize" : "Trigger Blockchain Draw"}
                </button>
              </div>
            </div>

            {/* Current Round List (Đã fix lỗi giãn trang bằng max-h-[350px]) */}
            <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-full min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Live Network</h2>
                <span className="bg-[#050810] border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-300">Total: {playersList.length} tickets</span>
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">Tickets awaiting draw:</p>
              <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto max-h-[350px] flex-1 space-y-3 custom-scrollbar">
                {playersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 py-10">
                    <span className="text-5xl mb-4">🎟️</span>
                    <p className="text-sm font-medium">No tickets purchased in this round yet.</p>
                  </div>
                ) : (
                  playersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0b1221] p-4 rounded-2xl border border-slate-800/50 hover:border-cyan-900/50 transition-colors">
                      <span className="text-slate-500 text-xs font-black uppercase">#{index + 1}</span>
                      <span className="text-cyan-400 font-mono text-sm truncate ml-4">{player}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Mega 6/45 */}
        {activeTab === 'mega' && (
           <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-12 shadow-2xl text-center animate-fadeIn">
             <h2 className="text-4xl font-black text-fuchsia-400 mb-4 tracking-tight">Mega 6/45 Jackpot</h2>
             <p className="text-slate-400 text-sm mb-12 max-w-lg mx-auto leading-relaxed">Select 6 lucky numbers. Match them all to win the grand multi-million pool. This feature is currently undergoing Smart Contract integration.</p>
             <div className="grid grid-cols-5 md:grid-cols-9 gap-3 mb-10 max-w-3xl mx-auto">
               {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                 <button key={num} onClick={() => toggleMegaNumber(num)} className={`aspect-square rounded-2xl font-black text-lg flex items-center justify-center transition-all duration-300 transform ${selectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(217,70,239,0.4)] scale-110 -translate-y-1' : 'bg-[#050810] text-slate-500 hover:text-white hover:bg-slate-800 border border-slate-800'}`}>
                   {num}
                 </button>
               ))}
             </div>
             <div className="bg-[#050810] p-6 rounded-3xl border border-slate-800 inline-block min-w-[300px]">
               <span className="text-slate-500 uppercase text-xs font-bold mr-4 tracking-wider">Your Selection ({selectedNumbers.length}/6):</span>
               <span className="font-mono text-fuchsia-400 font-bold text-2xl">{selectedNumbers.length > 0 ? selectedNumbers.sort((a,b)=>a-b).join(' - ') : '--'}</span>
             </div>
             <div className="mt-10">
               <button disabled className="bg-[#050810] border border-slate-800 text-slate-600 px-10 py-5 rounded-2xl font-black tracking-[0.2em] uppercase cursor-not-allowed">Submit Entry (Coming Soon)</button>
             </div>
           </div>
        )}

        {/* Tab 3: Scratch Cards */}
        {activeTab === 'scratch' && (
           <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-12 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
             <h2 className="text-4xl font-black text-amber-400 mb-4 tracking-tight">Instant Scratch Cards</h2>
             <p className="text-slate-400 text-sm mb-16 max-w-lg leading-relaxed">Experience sub-second blockchain finality. Buy, scratch, and reveal your prize instantly on the Arc Network.</p>
             <div className="relative group cursor-pointer">
               <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-orange-600 rounded-[40px] blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
               <div className="relative bg-gradient-to-br from-amber-400 to-orange-600 p-2 rounded-[36px] w-80 h-80 transform group-hover:scale-105 transition-all duration-500">
                 <div className="bg-[#050810] w-full h-full rounded-[30px] flex flex-col items-center justify-center border-4 border-dashed border-amber-500/20">
                   <span className="text-amber-500 font-black text-4xl uppercase tracking-widest mb-3">Scratch</span>
                   <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">To Reveal</span>
                 </div>
               </div>
             </div>
             <p className="text-slate-600 text-xs uppercase tracking-[0.3em] mt-16 font-bold bg-[#050810] px-6 py-2 rounded-full border border-slate-800">Smart Contract under Audit</p>
           </div>
        )}

        {/* Tab 4: Ledger & History (Cập nhật Logic Thống kê và Lịch sử trúng giải) */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            {/* Cột trái: Thống kê cá nhân + Vé vòng hiện tại */}
            <div className="flex flex-col gap-8">
              {/* Thống kê cá nhân */}
              <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 shadow-2xl">
                <h2 className="text-3xl font-black text-emerald-400 mb-6 tracking-tight">My Winning Stats</h2>
                {!wallet ? (
                  <p className="text-slate-500 text-sm mb-4">Please connect your wallet to view your personal winning statistics.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#050810] p-6 rounded-3xl border border-slate-800 text-center">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Total Wins</p>
                        <p className="text-3xl font-black text-white">{myWins.length}</p>
                      </div>
                      <div className="bg-emerald-950/20 p-6 rounded-3xl border border-emerald-900/50 text-center">
                        <p className="text-emerald-500/70 text-[10px] font-bold uppercase tracking-wider mb-1">Total Won (USDC)</p>
                        <p className="text-3xl font-black text-emerald-400">{totalMyWinnings.toFixed(1)}</p>
                      </div>
                    </div>
                    
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">My Past Wins:</p>
                    <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto max-h-[150px] custom-scrollbar space-y-2">
                      {myWins.length === 0 ? (
                        <p className="text-slate-600 text-sm italic text-center py-4">No wins yet.</p>
                      ) : (
                        myWins.map((win, i) => (
                          <div key={i} className="flex justify-between items-center bg-[#0b1221] p-3 rounded-2xl border border-slate-800/50">
                            <span className="text-slate-500 text-xs font-black uppercase">Round #{win.round}</span>
                            <span className="text-emerald-400 font-bold text-sm">+{win.prize} USDC</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Vé vòng hiện tại */}
              <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-cyan-400 tracking-tight">Active Inventory</h2>
                </div>
                {!wallet ? (
                  <p className="text-slate-500 text-sm">Connect wallet to view your active tickets for the current draw.</p>
                ) : (
                  <div>
                    {myTicketIndexes.length === 0 ? (
                      <p className="text-slate-600 text-sm italic text-center py-4">0 tickets in this round.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[150px] overflow-y-auto custom-scrollbar p-2">
                        {myTicketIndexes.map(idx => (
                          <div key={idx} className="bg-emerald-500/10 border border-emerald-500/30 py-2 rounded-xl text-center font-black text-emerald-400 font-mono shadow-inner text-xs hover:bg-emerald-500/20 transition-colors">
                            #{idx}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: Bảng vàng Lịch sử toàn cầu */}
            <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 md:p-10 shadow-2xl h-full">
              <h2 className="text-3xl font-black text-amber-400 mb-8 tracking-tight">Global Winners</h2>
              <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-6 overflow-y-auto max-h-[600px] space-y-4 custom-scrollbar">
                {historicalWinners.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                    <span className="text-4xl mb-4 opacity-50">📜</span>
                    <p className="text-sm font-medium">No past draws found or still syncing logs.</p>
                  </div>
                ) : (
                  historicalWinners.map((data, index) => (
                    <div key={index} className="bg-[#0b1221] border border-slate-800 hover:border-amber-500/30 p-5 rounded-2xl flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 transition-all group">
                      <div>
                         <span className="inline-block bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full mb-3 border border-amber-500/20">Round #{data.round}</span>
                         <div className="font-mono text-sm text-slate-300 group-hover:text-amber-200 transition-colors">
                           <span className="text-slate-500 mr-2 text-xs font-sans uppercase">Winner:</span> 
                           {data.winner}
                         </div>
                      </div>
                      <div className="xl:text-right">
                        <span className="block text-emerald-400 font-black text-xl drop-shadow-md">+{data.prize} USDC</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modern Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-[#050810]/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0b1221] border border-slate-700/50 rounded-[40px] max-w-sm w-full p-8 shadow-2xl shadow-cyan-900/20 transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white tracking-tight">Connect</h3>
              <button onClick={() => setShowWalletModal(false)} className="bg-[#050810] text-slate-400 hover:text-white hover:bg-slate-800 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="space-y-4">
              <button onClick={() => connectWallet('okx')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 hover:border-slate-600 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">⬛</span> OKX Wallet
              </button>
              <button onClick={() => connectWallet('binance')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 hover:border-slate-600 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">🔶</span> Binance Web3
              </button>
              <button onClick={() => connectWallet('trust')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 hover:border-slate-600 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">🛡️</span> Trust Wallet
              </button>
              <button onClick={() => connectWallet('browser')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 hover:border-slate-600 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">🦊</span> Browser Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}