'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// --- CONTRACT ADDRESSES ---
const CLASSIC_ADDRESS = "0xE0F2C50E2F2A6F91A02De6d9C398088113d9f5B0";
const MEGA_ADDRESS = "0x9A394437782F422C0B04416deCC21cDce0392bA4";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4CEF52";

// --- ABIs ---
const CLASSIC_ABI = [
  "function buyTickets(uint256 numberOfTickets) public payable",
  "function drawLottery() public",
  "function recentWinner() public view returns (address)",
  "function getPlayers() public view returns (address[])",
  "function getPoolBalance() public view returns (uint256)",
  "function lastDrawTime() public view returns (uint256)",
  "event WinnerPicked(address indexed winner, uint256 prizeAmount)"
];

const MEGA_ABI = [
  "function buyTicket(uint8 n1, uint8 n2, uint8 n3) public payable",
  "function drawJackpot() public",
  "function jackpotPool() public view returns (uint256)",
  "function seedPool() public view returns (uint256)",
  "function currentRound() public view returns (uint256)",
  "function lastDrawTime() public view returns (uint256)",
  "function getTicketsCount(uint256 round) public view returns (uint256)",
  "event TicketBought(address indexed player, uint256 round, uint8[3] numbers)",
  "event JackpotWon(uint256 indexed round, uint8[3] winningNumbers, uint256 winnersCount, uint256 prizePerWinner)",
  "event NoWinner(uint256 indexed round, uint8[3] winningNumbers, uint256 rolledOverAmount)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [signerInstance, setSignerInstance] = useState(null);
  const [activeTab, setActiveTab] = useState('classic'); 
  const [loadingState, setLoadingState] = useState(''); 
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000);
  };

  // --- CLASSIC STATE ---
  const [classicTicketCount, setClassicTicketCount] = useState(1);
  const [classicPoolBalance, setClassicPoolBalance] = useState('0.0');
  const [classicPlayersList, setClassicPlayersList] = useState([]);
  const [classicHistoricalWinners, setClassicHistoricalWinners] = useState([]);
  const [classicNextDrawTime, setClassicNextDrawTime] = useState(0);

  // --- MEGA STATE ---
  const [megaSelectedNumbers, setMegaSelectedNumbers] = useState([]);
  const [megaCart, setMegaCart] = useState([]); // Giỏ hàng lưu nhiều vé giống Vietlott
  const [megaPoolBalance, setMegaPoolBalance] = useState('0.0');
  const [megaSeedPoolBalance, setMegaSeedPoolBalance] = useState('0.0');
  const [megaCurrentRound, setMegaCurrentRound] = useState(1);
  const [megaTicketsCountThisRound, setMegaTicketsCountThisRound] = useState(0);
  const [megaHistoryLogs, setMegaHistoryLogs] = useState([]);
  const [myMegaTickets, setMyMegaTickets] = useState([]); 

  // --- TIME LOGIC ---
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const diffClassic = classicNextDrawTime - Math.floor(now / 1000);
  let classicTimeLeft = classicNextDrawTime > 0 ? (diffClassic <= 0 ? "READY TO DRAW!" : `${Math.floor(diffClassic / 60).toString().padStart(2, '0')}m ${(diffClassic % 60).toString().padStart(2, '0')}s`) : "Syncing...";

  // Đồng hồ UTC tròn giờ
  const currentUtc = new Date(now);
  const nextUtcHour = new Date(currentUtc);
  nextUtcHour.setUTCHours(currentUtc.getUTCHours() + 1, 0, 0, 0);
  const diffMega = Math.floor((nextUtcHour.getTime() - currentUtc.getTime()) / 1000);
  let megaTimeLeft = diffMega <= 0 ? "READY TO DRAW!" : `${Math.floor(diffMega / 60).toString().padStart(2, '0')}m ${(diffMega % 60).toString().padStart(2, '0')}s`;

  // --- FETCH DATA ---
  const fetchAllBlockchainData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      
      const classicContract = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, provider);
      setClassicPoolBalance(ethers.formatEther(await classicContract.getPoolBalance()));
      const cPlayers = await classicContract.getPlayers();
      setClassicPlayersList(cPlayers);
      const cLastTime = await classicContract.lastDrawTime();
      setClassicNextDrawTime(Number(cLastTime) + 3600);

      try {
        const cFilter = classicContract.filters.WinnerPicked();
        const cEvents = await classicContract.queryFilter(cFilter, -10000);
        setClassicHistoricalWinners(cEvents.map((e, i) => ({
          round: i + 1,
          winner: e.args[0],
          prize: ethers.formatEther(e.args[1])
        })).reverse());
      } catch (e) { console.error("Classic events error", e); }

      const megaContract = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, provider);
      setMegaPoolBalance(ethers.formatEther(await megaContract.jackpotPool()));
      setMegaSeedPoolBalance(ethers.formatEther(await megaContract.seedPool()));
      const mRound = await megaContract.currentRound();
      setMegaCurrentRound(Number(mRound));
      setMegaTicketsCountThisRound(Number(await megaContract.getTicketsCount(mRound)));

      try {
        const wonFilter = megaContract.filters.JackpotWon();
        const noFilter = megaContract.filters.NoWinner();
        const wonEvents = await megaContract.queryFilter(wonFilter, -10000);
        const noEvents = await megaContract.queryFilter(noFilter, -10000);
        const compiledMegaHistory = [];
        wonEvents.forEach(e => {
          compiledMegaHistory.push({ round: Number(e.args[0]), winningNumbers: e.args[1].join(' - '), status: 'WIN', detail: `${Number(e.args[2])} Winners`, prize: ethers.formatEther(e.args[3]) });
        });
        noEvents.forEach(e => {
          compiledMegaHistory.push({ round: Number(e.args[0]), winningNumbers: e.args[1].join(' - '), status: 'ROLLOVER', detail: 'No Winner - Rolled Over', prize: ethers.formatEther(e.args[2]) });
        });
        setMegaHistoryLogs(compiledMegaHistory.sort((a, b) => b.round - a.round));
      } catch (e) { console.error("Mega logs error", e); }

      // Lấy lịch sử vé của User
      if (wallet) {
         try {
           const myTicketLogs = await megaContract.queryFilter(megaContract.filters.TicketBought(wallet), -10000);
           setMyMegaTickets(myTicketLogs.map(e => ({ round: Number(e.args[1]), numbers: e.args[2].join(' - ') })).reverse());
         } catch(e) { console.error(e); }
      }

    } catch (err) { console.error("Fetch Data Critical Error:", err); }
  };

  useEffect(() => {
    fetchAllBlockchainData();
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
            setWallet(accounts[0]);
            setSignerInstance(await browserProvider.getSigner());
          }
        } catch (e) { console.error(e); }
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
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX }] }); } 
        catch (e) {
          if (e.code === 4902) {
            await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX, chainName: 'Arc Testnet', rpcUrls: [ARC_RPC_URL], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://explorer.testnet.arc.network'] }] });
          } else { throw e; }
        }
      }
      const updatedProvider = new ethers.BrowserProvider(targetProvider);
      const signer = await updatedProvider.getSigner();
      setWallet(await signer.getAddress());
      setSignerInstance(signer);
      setShowWalletModal(false);
      localStorage.setItem('connectedWalletType', walletType);
      await fetchAllBlockchainData();
      showToast("Wallet connected successfully!", "success");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleBuyClassicTickets = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    try {
      setLoadingState('Sign in Wallet...');
      const contract = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance);
      const totalCost = (0.1 * classicTicketCount).toFixed(1);
      const tx = await contract.buyTickets(classicTicketCount, { value: ethers.parseEther(totalCost) });
      setLoadingState('Mining Block...');
      await tx.wait();
      showToast(`Success! Purchased ${classicTicketCount} ticket(s).`, 'success');
      await fetchAllBlockchainData();
    } catch { showToast('Transaction failed or rejected.', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawClassic = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    try {
      setLoadingState('Sign to Draw...');
      const contract = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance);
      const tx = await contract.drawLottery();
      setLoadingState('Mining Block...');
      await tx.wait();
      const updated = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, new ethers.JsonRpcProvider(ARC_RPC_URL));
      const lastW = await updated.recentWinner();
      if (lastW.toLowerCase() === wallet.toLowerCase()) showToast('JACKPOT! YOU WON CLASSIC POOL!', 'success');
      else showToast(`Draw completed. Winner: ${lastW.substring(0,8)}...`, 'info');
      await fetchAllBlockchainData();
    } catch { showToast('Cannot Draw! Check condition.', 'error'); } finally { setLoadingState(''); }
  };

  // --- MEGA GIỎ HÀNG LOGIC ---
  const toggleMegaNumber = (num) => {
    if (megaSelectedNumbers.includes(num)) {
      setMegaSelectedNumbers(megaSelectedNumbers.filter(n => n !== num));
    } else if (megaSelectedNumbers.length < 3) {
      setMegaSelectedNumbers([...megaSelectedNumbers, num]);
    }
  };

  const addToMegaCart = () => {
     if (megaSelectedNumbers.length !== 3) return showToast('Bạn phải chọn đủ 3 số để tạo 1 vé!', 'error');
     const sorted = [...megaSelectedNumbers].sort((a, b) => a - b);
     setMegaCart([...megaCart, sorted]);
     setMegaSelectedNumbers([]);
     showToast('Đã thêm 1 vé vào giỏ hàng!', 'success');
  };

  const removeFromCart = (indexToRemove) => {
     setMegaCart(megaCart.filter((_, index) => index !== indexToRemove));
  };

  const handleCheckoutMegaCart = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    if (megaCart.length === 0) return showToast('Giỏ hàng trống!', 'error');
    try {
      setLoadingState('Sign in Wallet...');
      const contract = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance);
      
      // Do hợp đồng V1 của bạn thiết kế mua từng vé `buyTicket(n1,n2,n3)`. 
      // Để mua nhiều vé, ta phải duyệt giỏ hàng. Lệnh này sẽ gọi ví Metamask nhiều lần tùy số vé.
      for (let i = 0; i < megaCart.length; i++) {
         const ticket = megaCart[i];
         const tx = await contract.buyTicket(ticket[0], ticket[1], ticket[2], { value: ethers.parseEther("1.0") });
         if (i === megaCart.length - 1) { // Vé cuối cùng chờ đào block
            setLoadingState('Mining Final Block...');
            await tx.wait();
         }
      }

      showToast(`Mua thành công ${megaCart.length} vé Mega!`, 'success');
      setMegaCart([]);
      await fetchAllBlockchainData();
    } catch { showToast('Giao dịch mua vé thất bại hoặc bị từ chối.', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawMega = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    try {
      setLoadingState('Sign to Draw...');
      const contract = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance);
      const tx = await contract.drawJackpot();
      setLoadingState('Mining Block...');
      await tx.wait();
      showToast('Mega Draw Executed! Check the History tab.', 'success');
      await fetchAllBlockchainData();
    } catch { showToast('Draw condition not met (Not time yet).', 'error'); } finally { setLoadingState(''); }
  };

  const myMegaWinsCount = megaHistoryLogs.filter(h => h.status === 'WIN' && h.details.includes('Winners')).length;
return (
    <div className="min-h-screen bg-[#050810] text-white p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* TOAST NOTIFICATION */}
      {notification.show && (
        <div className="fixed top-8 left-0 right-0 flex justify-center z-[100] animate-fadeIn">
          <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 transition-all transform
            ${notification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 
              notification.type === 'error' ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 
              'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]'}`}>
            <p className="font-bold text-sm tracking-wide">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-10 mt-6">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-3 tracking-tighter">ARC LOTTERY</h1>
          <p className="text-cyan-400/80 text-sm font-bold tracking-[0.3em] uppercase">Fair • Transparent • On-Chain</p>
        </div>

        {/* Wallet Connetor */}
        <div className="flex justify-end mb-8">
          {wallet ? (
            <div className="flex items-center gap-3">
              <button onClick={() => { navigator.clipboard.writeText(wallet); showToast("Address Copied!", "success"); }} className="bg-[#0b1221] border border-cyan-900/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl font-bold text-cyan-400">
                {wallet.substring(0,6)}...{wallet.substring(38)}
              </button>
              <button onClick={() => { setWallet(''); setSignerInstance(null); localStorage.removeItem('connectedWalletType'); }} className="bg-rose-500/10 text-rose-400 py-3 px-5 rounded-2xl font-bold text-sm border border-rose-500/30">Log Out</button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="bg-gradient-to-r from-cyan-600 to-blue-700 py-3 px-8 rounded-2xl font-mono text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]">Connect Wallet</button>
          )}
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex gap-3 p-2 bg-[#0b1221]/80 backdrop-blur-md border border-slate-800/80 rounded-3xl mb-10 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'classic' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-500'}`}>CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'mega' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30' : 'text-slate-500'}`}>MEGA JACKPOT 3/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'scratch' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-500'}`}>SCRATCH CARDS</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'ledger' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-500'}`}>HISTORY & LEDGER</button>
        </div>

        {/* TAB 1: CLASSIC DRAW */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 flex flex-col group">
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black text-white">Classic Draw</h2>
                  <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-full">0.1 USDC / Ticket</span>
                </div>
                <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-6 mb-6 text-center">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-2">Time until next draw</p>
                  <div className="text-4xl font-black text-amber-400 font-mono">{classicTimeLeft}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/10 border border-emerald-500/30 rounded-3xl p-6 mb-6 text-center">
                  <p className="text-emerald-500/80 text-xs font-bold uppercase mb-2">Current Jackpot Pool</p>
                  <div className="text-5xl font-black text-emerald-400 font-mono">{classicPoolBalance} <span className="text-lg">USDC</span></div>
                </div>
                <div className="flex items-center justify-between bg-[#050810] py-4 px-6 rounded-2xl border border-slate-800 mb-8">
                  <span className="text-slate-400 text-sm font-bold uppercase">Buy Quantity:</span>
                  <input type="number" min="1" value={classicTicketCount} onChange={(e) => setClassicTicketCount(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent text-white font-black text-3xl text-center w-24 outline-none" />
                </div>
              </div>
              <div className="space-y-4 mt-auto">
                <button onClick={handleBuyClassicTickets} disabled={!!loadingState} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black py-4 rounded-2xl shadow-md uppercase tracking-wider">
                  {loadingState ? loadingState : `Confirm Purchase (${(0.1 * classicTicketCount).toFixed(1)} USDC)`}
                </button>
                <button onClick={handleDrawClassic} disabled={!!loadingState} className={`w-full font-bold py-4 rounded-2xl text-sm uppercase ${classicTimeLeft === "READY TO DRAW!" ? "bg-amber-500 text-[#050810]" : "bg-transparent border border-slate-800 text-slate-500"}`}>
                  Trigger Blockchain Draw
                </button>
              </div>
            </div>

            <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-full min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Live Network</h2>
                <span className="bg-[#050810] border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-300">Total: {classicPlayersList.length} tickets</span>
              </div>
              <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto max-h-[350px] flex-1 space-y-3 custom-scrollbar">
                {classicPlayersList.length === 0 ? (
                  <p className="text-slate-600 text-sm italic text-center py-10">No tickets purchased in this round yet.</p>
                ) : (
                  classicPlayersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0b1221] p-4 rounded-2xl border border-slate-800/50">
                      <span className="text-slate-500 text-xs font-black">#{index + 1}</span>
                      <span className="text-cyan-400 font-mono text-sm truncate ml-4">{player}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NEW MEGA JACKPOT 3/45 (CHỨC NĂNG GIỎ HÀNG VIETLOTT) */}
        {activeTab === 'mega' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            {/* Cột 1: Màn hình chọn vé */}
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col group">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-fuchsia-400">Mega Jackpot 3/45</h2>
                  <span className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-bold px-3 py-1 rounded-full">1.0 USDC / Ticket</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#050810] p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Time to UTC Draw</p>
                    <p className="text-xl font-mono font-black text-amber-400">{megaTimeLeft}</p>
                  </div>
                  <div className="bg-[#050810] p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Current Round</p>
                    <p className="text-xl font-black text-white">#{megaCurrentRound}</p>
                  </div>
                </div>

                <div className="bg-[#050810] border border-slate-800 rounded-3xl p-5 mb-6">
                  <div className="flex justify-between border-b border-slate-800 pb-3 mb-3">
                    <span className="text-slate-400 text-xs font-bold">ROLLOVER JACKPOT</span>
                    <span className="text-emerald-400 font-black text-2xl">{megaPoolBalance} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Seed Pool (Next Round Backup):</span>
                    <span className="text-teal-400 font-bold">{megaSeedPoolBalance} USDC</span>
                  </div>
                </div>

                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Select 3 numbers ({megaSelectedNumbers.length}/3):</p>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 p-3 bg-[#050810] rounded-2xl max-h-[180px] overflow-y-auto border border-slate-800/80 mb-6 custom-scrollbar">
                  {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                    <button key={num} onClick={() => toggleMegaNumber(num)} className={`py-2 rounded-xl text-xs font-black transition-all ${megaSelectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/50' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-500'}`}>
                      {num.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                <button onClick={addToMegaCart} disabled={megaSelectedNumbers.length !== 3} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-sm transition-colors border border-slate-700">
                  + Thêm vé vào giỏ hàng
                </button>
                <button onClick={handleDrawMega} disabled={!!loadingState} className={`w-full font-bold py-3 rounded-2xl text-xs uppercase ${megaTimeLeft === "READY TO DRAW!" ? "bg-amber-500 text-[#050810]" : "bg-transparent border border-slate-800 text-slate-500"}`}>
                  Trigger Mega Draw
                </button>
              </div>
            </div>

            {/* Cột 2: Giỏ hàng Vietlott */}
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-full min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-fuchsia-400">Giỏ Vé Của Bạn</h3>
                <span className="bg-[#050810] border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-300">Tổng: {megaCart.length} vé</span>
              </div>
              
              <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto max-h-[300px] flex-1 space-y-3 custom-scrollbar">
                {megaCart.length === 0 ? (
                  <p className="text-slate-600 text-sm italic text-center py-20">Chưa có vé nào trong giỏ. Hãy chọn số và thêm vé nhé!</p>
                ) : (
                  megaCart.map((ticket, idx) => (
                    <div key={idx} className="bg-[#0b1221] p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div className="flex gap-4 items-center">
                        <span className="text-slate-500 font-bold text-xs uppercase">Vé {String.fromCharCode(65 + idx)}</span>
                        <div className="flex gap-2">
                          {ticket.map((n, i) => <span key={i} className="bg-fuchsia-900/30 text-fuchsia-400 font-bold border border-fuchsia-500/20 w-8 h-8 rounded-full flex items-center justify-center text-xs">{n.toString().padStart(2, '0')}</span>)}
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-400 px-3 font-bold text-xl">×</button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="flex justify-between mb-4">
                  <span className="text-slate-400 font-bold uppercase text-sm">Tổng Thanh Toán:</span>
                  <span className="text-2xl font-black text-fuchsia-400">{megaCart.length.toFixed(1)} USDC</span>
                </div>
                <button onClick={handleCheckoutMegaCart} disabled={!!loadingState || megaCart.length === 0} className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 disabled:from-slate-800 disabled:to-slate-900 text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-wider text-sm">
                  {loadingState ? loadingState : "THANH TOÁN TOÀN BỘ VÉ"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCRATCH CARDS */}
        {activeTab === 'scratch' && (
           <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-12 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
             <h2 className="text-4xl font-black text-amber-400 mb-4">Instant Scratch Cards</h2>
             <p className="text-slate-400 text-sm mb-12 max-w-lg">Buy, scratch, and reveal your prize instantly on the Arc Network.</p>
             <div className="relative bg-gradient-to-br from-amber-400 to-orange-600 p-1.5 rounded-[36px] w-72 h-72">
               <div className="bg-[#050810] w-full h-full rounded-[30px] flex flex-col items-center justify-center border-4 border-dashed border-amber-500/20">
                 <span className="text-amber-500 font-black text-4xl uppercase tracking-widest mb-3">Scratch</span>
                 <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">To Reveal</span>
               </div>
             </div>
             <p className="text-slate-600 text-xs uppercase mt-12 font-bold bg-[#050810] px-6 py-2 rounded-full border border-slate-800">Smart Contract under Audit</p>
           </div>
        )}

        {/* TAB 4: HISTORY & LEDGER (GỒM CẢ THỐNG KÊ VÀ LỊCH SỬ) */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            
            {/* Lịch sử Mega Toàn Mạng */}
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-full min-h-[600px]">
              <h2 className="text-2xl font-black text-fuchsia-400 mb-2">Mega Jackpot 3/45 History</h2>
              <p className="text-slate-500 text-xs mb-6 uppercase tracking-wider font-bold">Lịch sử tích lũy Rollover & Nổ hũ Toàn Mạng</p>
              <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto max-h-[500px] flex-1 space-y-3 custom-scrollbar">
                {megaHistoryLogs.length === 0 ? (
                  <p className="text-slate-600 text-sm italic text-center py-20">No logs found.</p>
                ) : (
                  megaHistoryLogs.map((log, index) => (
                    <div key={index} className={`bg-[#0b1221] p-4 rounded-xl border flex flex-col gap-2 transition-all ${log.status === 'WIN' ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-amber-500/20'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-black uppercase px-3 py-0.5 rounded-full border ${log.status === 'WIN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                          Round #{log.round} - {log.status}
                        </span>
                        <span className={`font-black text-md ${log.status === 'WIN' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {log.status === 'WIN' ? `Each Winner: +${log.prize} USDC` : `Pool Roll: ${log.prize} USDC`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-mono">Winning Numbers: <span className="text-white font-bold">{log.winningNumbers}</span></span>
                        <span className="text-slate-500 italic text-[11px]">{log.detail}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-8">
               {/* My Tickets Thống kê Cá nhân */}
               <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col">
                  <h2 className="text-xl font-black text-emerald-400 mb-4">My Mega Inventory</h2>
                  {wallet ? (
                     <>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="p-4 bg-[#050810] border border-slate-800 rounded-xl text-center">
                              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Tickets Bought</p>
                              <p className="text-2xl font-black text-white">{myMegaTickets.length}</p>
                           </div>
                           <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-center">
                              <p className="text-emerald-500 text-[10px] uppercase font-bold mb-1">Mega Wins (Rounds)</p>
                              <p className="text-2xl font-black text-emerald-400">{myMegaWinsCount}</p>
                           </div>
                        </div>
                        <p className="text-slate-500 text-xs mb-2 uppercase font-bold">Lịch sử số đã mua:</p>
                        <div className="bg-[#050810] border border-slate-800 rounded-2xl p-3 overflow-y-auto max-h-[150px] custom-scrollbar space-y-2">
                           {myMegaTickets.length === 0 ? <p className="text-slate-600 text-xs text-center py-4">Chưa có vé nào.</p> : 
                            myMegaTickets.map((t, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-[#0b1221] p-2 rounded-lg border border-slate-700">
                                 <span className="text-fuchsia-400 font-black text-[10px] uppercase">R#{t.round}</span>
                                 <span className="font-mono text-white text-xs">{t.numbers}</span>
                              </div>
                           ))}
                        </div>
                     </>
                  ) : <p className="text-slate-600 text-sm py-4">Connect wallet to view.</p>}
               </div>

               {/* Lịch sử Classic Toàn mạng */}
               <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col flex-1">
                 <h2 className="text-xl font-black text-cyan-400 mb-2">Classic Draw History</h2>
                 <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto max-h-[250px] space-y-3 custom-scrollbar mt-2">
                   {classicHistoricalWinners.length === 0 ? (
                     <p className="text-slate-600 text-sm italic text-center py-10">No logs found.</p>
                   ) : (
                     classicHistoricalWinners.map((data, index) => (
                       <div key={index} className="bg-[#0b1221] p-3 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                         <div className="flex justify-between items-center">
                           <span className="text-cyan-400 font-black text-[10px] uppercase">Round #{data.round}</span>
                           <span className="text-emerald-400 font-black text-sm">+{data.prize} USDC</span>
                         </div>
                         <p className="text-xs font-mono text-slate-500 truncate">Win: {data.winner}</p>
                       </div>
                     ))
                   )}
                 </div>
               </div>
            </div>

          </div>
        )}

      </div>

      {/* Wallet Selector Modal Pop-up */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-[#050810]/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0b1221] border border-slate-700/50 rounded-[40px] max-w-sm w-full p-8 shadow-2xl shadow-cyan-900/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white tracking-tight">Connect</h3>
              <button onClick={() => setShowWalletModal(false)} className="bg-[#050810] text-slate-400 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center">✕</button>
            </div>
            <div className="space-y-4">
              <button onClick={() => connectWallet('okx')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 group">OKX Wallet</button>
              <button onClick={() => connectWallet('binance')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 group">Binance Web3</button>
              <button onClick={() => connectWallet('trust')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 group">Trust Wallet</button>
              <button onClick={() => connectWallet('browser')} className="w-full bg-[#050810] hover:bg-slate-800 border border-slate-800 py-4 px-6 rounded-2xl text-sm font-bold flex items-center gap-4 group">Browser Extension</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}