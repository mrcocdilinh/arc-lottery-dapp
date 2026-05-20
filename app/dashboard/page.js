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
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(null);
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

  const formatAddr = (addr) => addr ? `${addr.substring(0, 6)}xxxx${addr.substring(addr.length - 4)}` : '';

  const formatUtcRoundCode = (timestamp) => {
    if (!timestamp) return 'UNKNOWN';
    const d = new Date(timestamp * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${h}`;
  };

  const formatNumbersSafe = (arr) => {
    try { 
      // Xử lý an toàn tuyệt đối mảng BigInt của Ethers v6
      return `${Number(arr[0]).toString().padStart(2, '0')} - ${Number(arr[1]).toString().padStart(2, '0')} - ${Number(arr[2]).toString().padStart(2, '0')}`;
    } catch(e) { return 'N/A'; }
  };

  // --- CLASSIC STATE ---
  const [classicTicketCount, setClassicTicketCount] = useState(1);
  const [classicPoolBalance, setClassicPoolBalance] = useState('0.0');
  const [classicPlayersList, setClassicPlayersList] = useState([]);
  const [classicHistoricalWinners, setClassicHistoricalWinners] = useState([]);
  const [classicNextDrawCode, setClassicNextDrawCode] = useState('');
  const [classicNextDrawTime, setClassicNextDrawTime] = useState(0);

  // --- MEGA STATE ---
  const [megaSelectedNumbers, setMegaSelectedNumbers] = useState([]);
  const [megaCart, setMegaCart] = useState([]);
  const [megaPoolBalance, setMegaPoolBalance] = useState('0.0');
  const [megaSeedPoolBalance, setMegaSeedPoolBalance] = useState('0.0');
  const [megaNextDrawCode, setMegaNextDrawCode] = useState('');
  const [megaNextDrawTime, setMegaNextDrawTime] = useState(0); // Sửa đồng bộ với Smart Contract
  const [megaCurrentRound, setMegaCurrentRound] = useState(1);
  const [megaTicketsCountThisRound, setMegaTicketsCountThisRound] = useState(0);
  const [megaHistoryLogs, setMegaHistoryLogs] = useState([]);
  const [myMegaTickets, setMyMegaTickets] = useState([]);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  // --- FETCH BLOCKCHAIN DATA ---
  const fetchAllBlockchainData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      const currentBlock = await provider.getBlockNumber();
      let fromBlock = currentBlock - 100000; 
      if (fromBlock < 0) fromBlock = 0;
      
      // FETCH CLASSIC
      const classicContract = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, provider);
      setClassicPoolBalance(ethers.formatEther(await classicContract.getPoolBalance()));
      setClassicPlayersList(await classicContract.getPlayers());
      
      const cLastTime = Number(await classicContract.lastDrawTime());
      setClassicNextDrawTime(cLastTime + 3600);
      setClassicNextDrawCode(formatUtcRoundCode(cLastTime + 3600));

      try {
        const cEvents = await classicContract.queryFilter(classicContract.filters.WinnerPicked(), fromBlock, currentBlock);
        setClassicHistoricalWinners(cEvents.map((e, i) => {
          const expectedTs = cLastTime - ((cEvents.length - 1 - i) * 3600);
          return { roundCode: formatUtcRoundCode(expectedTs), winner: e.args[0], prize: ethers.formatEther(e.args[1]) };
        }).reverse());
      } catch (e) { console.error("Classic logs error", e); }

      // FETCH MEGA
      const megaContract = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, provider);
      setMegaPoolBalance(ethers.formatEther(await megaContract.jackpotPool()));
      setMegaSeedPoolBalance(ethers.formatEther(await megaContract.seedPool()));
      
      const mRound = Number(await megaContract.currentRound());
      const mLastTime = Number(await megaContract.lastDrawTime());
      setMegaCurrentRound(mRound);
      setMegaNextDrawTime(mLastTime + 3600); // ĐỒNG BỘ THỜI GIAN THỰC TẾ CỦA SMART CONTRACT
      setMegaNextDrawCode(formatUtcRoundCode(mLastTime + 3600));
      setMegaTicketsCountThisRound(Number(await megaContract.getTicketsCount(mRound)));

      try {
        const wonEvents = await megaContract.queryFilter(megaContract.filters.JackpotWon(), fromBlock, currentBlock);
        const noEvents = await megaContract.queryFilter(megaContract.filters.NoWinner(), fromBlock, currentBlock);
        const compiledMegaHistory = [];
        
        wonEvents.forEach(e => {
          const r = Number(e.args[0]);
          const expectedTs = mLastTime - ((mRound - 1 - r) * 3600);
          compiledMegaHistory.push({ roundIdx: r, roundCode: formatUtcRoundCode(expectedTs), winningNumbers: formatNumbersSafe(e.args[1]), status: 'WIN', detail: `${Number(e.args[2])} Winners sharing`, prize: ethers.formatEther(e.args[3]) });
        });
        
        noEvents.forEach(e => {
          const r = Number(e.args[0]);
          const expectedTs = mLastTime - ((mRound - 1 - r) * 3600);
          compiledMegaHistory.push({ roundIdx: r, roundCode: formatUtcRoundCode(expectedTs), winningNumbers: formatNumbersSafe(e.args[1]), status: 'ROLLOVER', detail: 'No Winners (Rolled Over)', prize: ethers.formatEther(e.args[2]) });
        });
        setMegaHistoryLogs(compiledMegaHistory.sort((a, b) => b.roundIdx - a.roundIdx));
      } catch (e) { console.error("Mega logs error", e); }

      if (wallet) {
         try {
           const myTicketLogs = await megaContract.queryFilter(megaContract.filters.TicketBought(wallet), fromBlock, currentBlock);
           setMyMegaTickets(myTicketLogs.map(e => {
             const r = Number(e.args[1]);
             const expectedTs = mLastTime - ((mRound - 1 - r) * 3600);
             return { roundIdx: r, roundCode: formatUtcRoundCode(expectedTs), numbers: formatNumbersSafe(e.args[2]) };
           }).reverse());
         } catch(e) { console.error("My tickets fetch error", e); }
      }

    } catch (err) { console.error("Fetch Data Error:", err); }
  };

  useEffect(() => {
    fetchAllBlockchainData();
    const autoReconnect = async () => {
      const savedWalletType = localStorage.getItem('connectedWalletType');
      if (!savedWalletType || typeof window === 'undefined') return;
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            setWallet(accounts[0]);
            setSignerInstance(await browserProvider.getSigner());
          } else { localStorage.removeItem('connectedWalletType'); }
        } catch (e) { console.error(e); }
      }
    };
    setTimeout(autoReconnect, 500);
  }, []);

  useEffect(() => { if (wallet) fetchAllBlockchainData(); }, [wallet]);

  if (!mounted || !now) return null;

  // --- TIME CALCULATIONS (SYNCED WITH SMART CONTRACTS) ---
  const diffClassic = classicNextDrawTime - Math.floor(now / 1000);
  let isClassicReadyToDraw = false;
  let classicTimeLeft = "Syncing...";
  if (classicNextDrawTime > 0) {
    if (diffClassic <= 0) { classicTimeLeft = "READY TO DRAW!"; isClassicReadyToDraw = true; } 
    else { classicTimeLeft = `${Math.floor(diffClassic / 60).toString().padStart(2, '0')}m ${(diffClassic % 60).toString().padStart(2, '0')}s`; }
  }

  const diffMega = megaNextDrawTime - Math.floor(now / 1000);
  let isMegaReadyToDraw = false;
  let megaTimeLeft = "Syncing...";
  if (megaNextDrawTime > 0) {
    if (diffMega <= 0) { megaTimeLeft = "READY TO DRAW!"; isMegaReadyToDraw = true; } 
    else { megaTimeLeft = `${Math.floor(diffMega / 60).toString().padStart(2, '0')}m ${(diffMega % 60).toString().padStart(2, '0')}s`; }
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const network = await browserProvider.getNetwork();
        if (Number(network.chainId) !== ARC_CHAIN_ID) {
          try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX }] }); } 
          catch (e) {
            if (e.code === 4902) { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX, chainName: 'Arc Testnet', rpcUrls: [ARC_RPC_URL], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://explorer.testnet.arc.network'] }] }); } 
            else { throw e; }
          }
        }
        const signer = await browserProvider.getSigner();
        setWallet(await signer.getAddress());
        setSignerInstance(signer);
        setShowWalletModal(false);
        localStorage.setItem('connectedWalletType', 'browser');
        showToast("Wallet connected successfully!", "success");
      } catch (err) { showToast(err.message, "error"); }
    } else { showToast("No Web3 wallet extension detected!", "error"); }
  };

  const handleBuyClassicTickets = async () => {
    if (!signerInstance) return showToast('Please connect your wallet first!', 'error');
    if (isClassicReadyToDraw) return showToast('Round has ended! Please trigger the draw first.', 'error');
    try {
      setLoadingState('Signing...');
      const contract = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance);
      const tx = await contract.buyTickets(classicTicketCount, { value: ethers.parseEther((0.1 * classicTicketCount).toFixed(1)) });
      setLoadingState('Mining...');
      await tx.wait();
      showToast(`Purchased ${classicTicketCount} ticket(s).`, 'success');
      await fetchAllBlockchainData();
    } catch { showToast('Transaction failed.', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawClassic = async () => {
    if (!signerInstance) return showToast('Please connect your wallet!', 'error');
    try {
      setLoadingState('Executing Draw...');
      await (await new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance).drawLottery()).wait();
      showToast('Draw completed!', 'success');
      await fetchAllBlockchainData();
    } catch { showToast('Draw condition not met.', 'error'); } finally { setLoadingState(''); }
  };

  const toggleMegaNumber = (num) => {
    if (megaSelectedNumbers.includes(num)) setMegaSelectedNumbers(megaSelectedNumbers.filter(n => n !== num));
    else if (megaSelectedNumbers.length < 3) setMegaSelectedNumbers([...megaSelectedNumbers, num]);
  };

  const addToMegaCart = () => {
     if (megaSelectedNumbers.length !== 3) return showToast('Select exactly 3 numbers!', 'error');
     setMegaCart([...megaCart, [...megaSelectedNumbers].sort((a, b) => a - b)]);
     setMegaSelectedNumbers([]);
     showToast('Added ticket to cart!', 'success');
  };

  const removeFromCart = (indexToRemove) => setMegaCart(megaCart.filter((_, index) => index !== indexToRemove));

  const handleCheckoutMegaCart = async () => {
    if (!signerInstance) return showToast('Please connect your wallet!', 'error');
    if (megaCart.length === 0) return showToast('Cart is empty!', 'error');
    if (isMegaReadyToDraw) return showToast('Round has ended! Please trigger the draw first.', 'error');
    try {
      setLoadingState('Signing...');
      const contract = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance);
      for (let i = 0; i < megaCart.length; i++) {
         const t = megaCart[i];
         const tx = await contract.buyTicket(t[0], t[1], t[2], { value: ethers.parseEther("1.0") });
         if (i === megaCart.length - 1) {
            setLoadingState('Mining...');
            await tx.wait();
         }
      }
      showToast(`Successfully purchased ${megaCart.length} tickets!`, 'success');
      setMegaCart([]);
      await fetchAllBlockchainData();
    } catch { showToast('Transaction failed.', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawMega = async () => {
    if (!signerInstance) return showToast('Please connect your wallet!', 'error');
    try {
      setLoadingState('Executing Draw...');
      await (await new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance).drawJackpot()).wait();
      showToast('Mega Draw Executed!', 'success');
      await fetchAllBlockchainData();
    } catch { showToast('Draw condition not met.', 'error'); } finally { setLoadingState(''); }
  };

  const myMegaWinsCount = myMegaTickets.filter(t => megaHistoryLogs.some(h => h.roundIdx === t.roundIdx && h.status === 'WIN' && h.winningNumbers === t.numbers)).length;
  const myClassicWinsCount = classicHistoricalWinners.filter(h => h.winner.toLowerCase() === wallet.toLowerCase()).length;
  const myClassicWinnings = classicHistoricalWinners.filter(h => h.winner.toLowerCase() === wallet.toLowerCase()).reduce((acc, curr) => acc + parseFloat(curr.prize), 0);
  const myClassicTicketsThisRound = classicPlayersList.map((p, i) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? i + 1 : null)).filter(i => i !== null);
  const latestMegaResult = megaHistoryLogs.length > 0 ? megaHistoryLogs[0] : null;

  return (
    <div className="min-h-screen bg-[#050810] text-white p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {notification.show && (
        <div className="fixed top-8 left-0 right-0 flex justify-center z-[100] animate-fadeIn">
          <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 transition-all transform ${notification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
            <p className="font-bold text-sm tracking-wide">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-10 mt-6">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-3 tracking-tighter">ARC LOTTERY</h1>
          <p className="text-cyan-400/80 text-sm font-bold tracking-[0.3em] uppercase">Fair • Transparent • On-Chain</p>
        </div>

        <div className="flex justify-end mb-8">
          {wallet ? (
            <div className="flex items-center gap-3">
              <button onClick={() => { navigator.clipboard.writeText(wallet); showToast("Address Copied!", "success"); }} className="bg-[#0b1221] border border-cyan-900/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl font-bold text-cyan-400">
                {formatAddr(wallet)}
              </button>
              <button onClick={() => { setWallet(''); setSignerInstance(null); localStorage.removeItem('connectedWalletType'); }} className="bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-rose-400 py-3 px-5 rounded-2xl font-bold text-sm border border-rose-500/30">Log Out</button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="bg-gradient-to-r from-blue-600 to-indigo-700 py-3 px-8 rounded-2xl font-mono text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-105 transition-transform">Connect Wallet</button>
          )}
        </div>

        <div className="flex gap-3 p-2 bg-[#0b1221]/80 backdrop-blur-md border border-slate-800/80 rounded-3xl mb-10 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'classic' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:bg-slate-800/50'}`}>CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'mega' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30' : 'text-slate-500 hover:bg-slate-800/50'}`}>MEGA JACKPOT 3/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'scratch' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:bg-slate-800/50'}`}>SCRATCH CARDS</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'ledger' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:bg-slate-800/50'}`}>PERSONAL LEDGER</button>
        </div>

        {/* TAB 1: CLASSIC DRAW */}
        {activeTab === 'classic' && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 flex flex-col h-[600px]">
                <div>
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black text-white">Classic Draw</h2>
                    <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-full">0.1 USDC / Ticket</span>
                  </div>
                  <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-6 mb-6 text-center">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-2">Time until next draw</p>
                    <div className="text-4xl font-black text-amber-400 font-mono">{classicTimeLeft}</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/10 border border-emerald-500/30 rounded-3xl p-6 mb-6 text-center">
                    <p className="text-emerald-500/80 text-[10px] font-bold uppercase mb-2">Current Jackpot Pool</p>
                    <div className="text-5xl font-black text-emerald-400 font-mono">{classicPoolBalance} <span className="text-lg">USDC</span></div>
                  </div>
                  <div className="flex items-center justify-between bg-[#050810] py-4 px-6 rounded-2xl border border-slate-800 mb-6">
                    <span className="text-slate-400 text-sm font-bold uppercase">Buy Quantity:</span>
                    <input type="number" min="1" value={classicTicketCount} onChange={(e) => setClassicTicketCount(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent text-white font-black text-3xl text-center w-24 outline-none" />
                  </div>
                </div>
                <div className="space-y-3 mt-auto">
                  <button onClick={handleBuyClassicTickets} disabled={!!loadingState || isClassicReadyToDraw} className={`w-full text-white font-black py-4 rounded-2xl shadow-md uppercase tracking-wider text-sm transition-all ${isClassicReadyToDraw ? "bg-slate-800 cursor-not-allowed text-slate-500" : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"}`}>
                    {loadingState ? loadingState : (isClassicReadyToDraw ? "DRAW REQUIRED FIRST" : `Confirm Purchase (${(0.1 * classicTicketCount).toFixed(1)} USDC)`)}
                  </button>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold">* Web3 requires a manual gas trigger to draw</p>
                    <button onClick={handleDrawClassic} disabled={!!loadingState || !isClassicReadyToDraw} className={`w-full font-bold py-3 rounded-2xl text-xs uppercase transition-colors ${isClassicReadyToDraw ? "bg-amber-500 text-[#050810] hover:bg-amber-400" : "bg-transparent border border-slate-800 text-slate-600 cursor-not-allowed"}`}>
                      Trigger Blockchain Draw
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b1221]/70 backdrop-blur-2xl border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-[600px]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-widest">Live Network</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold text-right">Round Code<br/>{classicNextDrawCode}</span>
                    <span className="bg-[#050810] border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-300">Total: {classicPlayersList.length}</span>
                  </div>
                </div>
                <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                  {classicPlayersList.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-20">No tickets purchased in this round yet.</p> : classicPlayersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0b1221] p-3 rounded-2xl border border-slate-800/50">
                      <span className="text-slate-500 text-[10px] font-black uppercase">Ticket #{index + 1}</span>
                      <span className="text-cyan-400 font-mono text-sm">{formatAddr(player)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col w-full h-[400px]">
              <h2 className="text-2xl font-black text-cyan-400 mb-2">Global Classic History</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Past Winners Overview</p>
              <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                {classicHistoricalWinners.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-10">No history found.</p> : classicHistoricalWinners.map((data, index) => (
                  <div key={index} className="flex justify-between items-center bg-[#0b1221] p-4 rounded-2xl border border-slate-800/50 hover:border-cyan-500/30 transition-colors">
                    <div>
                      <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase px-3 py-1 rounded-full">{data.roundCode}</span>
                      <p className="text-sm font-mono text-slate-400 mt-2">Winner: <span className="text-white">{formatAddr(data.winner)}</span></p>
                    </div>
                    <span className="text-emerald-400 font-black text-xl">+{data.prize} USDC</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEGA JACKPOT 3/45 */}
        {activeTab === 'mega' && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col flex-1 h-[650px]">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-fuchsia-400">Mega Jackpot 3/45</h2>
                    <span className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-bold px-3 py-1 rounded-full">1.0 USDC / Ticket</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-[#050810] p-4 rounded-2xl border border-slate-800 text-center">
                      <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Time to draw</p>
                      <p className="text-xl font-mono font-black text-amber-400">{megaTimeLeft}</p>
                    </div>
                    <div className="bg-[#050810] p-4 rounded-2xl border border-slate-800 text-center">
                      <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Draw Code</p>
                      <p className="text-md font-black text-white mt-1">{megaNextDrawCode}</p>
                    </div>
                  </div>
                  <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 mb-6">
                    <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                      <span className="text-slate-400 text-[10px] font-bold uppercase mt-1">Accumulated Jackpot</span>
                      <span className="text-emerald-400 font-black text-2xl">{megaPoolBalance} USDC</span>
                    </div>
                    {/* HIỂN THỊ LỊCH SỬ KẾT QUẢ GẦN NHẤT ĐỂ MINH BẠCH */}
                    {latestMegaResult && (
                       <div className="flex justify-between items-center bg-[#0b1221]/50 p-2 rounded-xl mt-2 border border-slate-800">
                         <span className="text-slate-500 text-[9px] uppercase font-bold">Last Result ({latestMegaResult.roundCode})</span>
                         <span className="text-white font-mono font-bold tracking-widest text-sm">{latestMegaResult.winningNumbers}</span>
                       </div>
                    )}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Select exactly 3 numbers ({megaSelectedNumbers.length}/3):</p>
                  <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 p-3 bg-[#050810] rounded-2xl overflow-y-auto border border-slate-800/80 mb-6 custom-scrollbar">
                    {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                      <button key={num} onClick={() => toggleMegaNumber(num)} className={`py-2 rounded-xl text-xs font-black transition-all ${megaSelectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/50' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-500'}`}>{num.toString().padStart(2, '0')}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-auto">
                  <button onClick={addToMegaCart} disabled={megaSelectedNumbers.length !== 3} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors border border-slate-700 disabled:opacity-50">+ Add Ticket To Cart</button>
                </div>
              </div>

              <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col h-full min-h-[650px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-fuchsia-400">Your Ticket Cart</h3>
                  <span className="bg-[#050810] border border-slate-700 px-3 py-1 rounded-full text-xs font-bold text-slate-300">Total: {megaCart.length}</span>
                </div>
                <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                  {megaCart.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-20">Cart is empty. Select numbers to add.</p> : megaCart.map((ticket, idx) => (
                    <div key={idx} className="bg-[#0b1221] p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div className="flex gap-4 items-center">
                        <span className="text-slate-500 font-bold text-[10px] uppercase">Ticket {String.fromCharCode(65 + idx)}</span>
                        <div className="flex gap-2">
                          {ticket.map((n, i) => <span key={i} className="bg-fuchsia-900/30 text-fuchsia-400 font-bold border border-fuchsia-500/20 w-8 h-8 rounded-full flex items-center justify-center text-[11px]">{n.toString().padStart(2, '0')}</span>)}
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-400 px-3 font-bold text-xl">×</button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="flex justify-between mb-4 items-end">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Total Checkout:</span>
                    <span className="text-2xl font-black text-fuchsia-400">{megaCart.length.toFixed(1)} USDC</span>
                  </div>
                  <button onClick={handleCheckoutMegaCart} disabled={!!loadingState || megaCart.length === 0 || isMegaReadyToDraw} className={`w-full text-white font-black py-4 rounded-2xl shadow-lg uppercase text-sm mb-3 transition-all ${isMegaReadyToDraw || megaCart.length === 0 ? "bg-slate-800 cursor-not-allowed opacity-50 text-slate-500" : "bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90"}`}>
                    {loadingState ? loadingState : (isMegaReadyToDraw ? "DRAW REQUIRED FIRST" : "CHECKOUT ALL TICKETS")}
                  </button>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold">* Web3 requires a manual gas trigger to draw</p>
                    <button onClick={handleDrawMega} disabled={!!loadingState || !isMegaReadyToDraw} className={`w-full font-bold py-3 rounded-2xl text-xs uppercase transition-colors ${isMegaReadyToDraw ? "bg-amber-500 text-[#050810] hover:bg-amber-400" : "bg-transparent border border-slate-800 text-slate-600 cursor-not-allowed"}`}>
                      Trigger Mega Draw
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col w-full h-[400px]">
              <h2 className="text-2xl font-black text-fuchsia-400 mb-2">Global Mega History</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Rollover & Win Activity</p>
              <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                {megaHistoryLogs.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-10">No logs found.</p> : megaHistoryLogs.map((log, index) => (
                  <div key={index} className={`bg-[#0b1221] p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-fuchsia-500/30 ${log.status === 'WIN' ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-amber-500/20'}`}>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      <span className={`w-max text-[10px] font-black uppercase px-3 py-1 rounded-full border ${log.status === 'WIN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        {log.roundCode} - {log.status}
                      </span>
                      <span className="text-slate-400 font-mono text-sm mt-1">Drawn Numbers: <span className="text-white font-bold tracking-widest">{log.winningNumbers}</span></span>
                    </div>
                    <div className="flex flex-col md:items-end w-full md:w-auto">
                      <span className={`font-black text-xl ${log.status === 'WIN' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {log.status === 'WIN' ? `Each: +${log.prize} USDC` : `Pool Roll: ${log.prize} USDC`}
                      </span>
                      <span className="text-slate-500 italic text-[11px] mt-1">{log.detail}</span>
                    </div>
                  </div>
                ))}
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

        {/* TAB 4: PERSONAL LEDGER */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col h-[600px]">
              <h2 className="text-2xl font-black text-fuchsia-400 mb-2">My Mega Profile</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Your Tickets History & Round Results</p>
              {!wallet ? <p className="text-slate-600 text-sm py-20 text-center italic">Connect wallet to view your personal ledger.</p> : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                     <div className="p-4 bg-[#050810] border border-slate-800 rounded-xl text-center">
                        <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Tickets Bought</p>
                        <p className="text-2xl font-black text-white">{myMegaTickets.length}</p>
                     </div>
                     <div className="p-4 bg-fuchsia-950/20 border border-fuchsia-900/50 rounded-xl text-center">
                        <p className="text-fuchsia-500 text-[10px] uppercase font-bold mb-1">Winning Rounds</p>
                        <p className="text-2xl font-black text-fuchsia-400">{myMegaWinsCount}</p>
                     </div>
                  </div>
                  
                  <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                    {myMegaTickets.length === 0 ? (
                      <p className="text-slate-600 text-sm italic text-center py-10">No Mega tickets found for this address.</p>
                    ) : (
                      myMegaTickets.map((t, index) => {
                        const roundOutcome = megaHistoryLogs.find(h => h.roundIdx === t.roundIdx);
                        const winningNums = roundOutcome ? roundOutcome.winningNumbers : 'WAITING...';
                        const isWin = roundOutcome && roundOutcome.status === 'WIN' && roundOutcome.winningNumbers === t.numbers;
                        const prizeAmount = isWin ? roundOutcome.prize : '0.0';
                        const isPending = t.roundIdx === megaCurrentRound;

                        return (
                          <div key={index} className={`p-4 rounded-2xl border flex flex-col gap-2 transition-colors bg-[#0b1221]/50 ${isWin ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800'}`}>
                            <div className="flex justify-between items-center">
                              <span className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">{t.roundCode}</span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isPending ? 'bg-amber-500/10 text-amber-400' : (isWin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500')}`}>
                                {isPending ? 'PENDING' : (isWin ? 'WON' : 'LOST')}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-xs mt-1">
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-bold uppercase text-[10px]">Your Pick:</span>
                                <span className="text-white font-mono font-bold tracking-wider">{t.numbers}</span>
                              </div>
                              {!isPending && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500 font-bold uppercase text-[10px]">Result:</span>
                                  <span className="text-slate-300 font-mono font-bold tracking-wider">{winningNums}</span>
                                </div>
                              )}
                              {isWin && <p className="text-emerald-400 font-black text-sm mt-2 text-right">Prize Awarded: +{prizeAmount} USDC</p>}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col h-[600px]">
              <h2 className="text-2xl font-black text-cyan-400 mb-2">My Classic Profile</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Your Active Position & Historical Winnings</p>
              {!wallet ? <p className="text-slate-600 text-sm py-20 text-center italic">Connect wallet to view your personal ledger.</p> : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                     <div className="p-3 bg-[#050810] border border-slate-800 rounded-xl text-center">
                        <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Wins / Active Tickets</p>
                        <p className="text-xl font-black text-white">{myClassicWinsCount} / {myClassicTicketsThisRound.length}</p>
                     </div>
                     <div className="p-3 bg-cyan-950/20 border border-cyan-900/50 rounded-xl text-center">
                        <p className="text-cyan-500 text-[10px] uppercase font-bold mb-1">Total USDC Won</p>
                        <p className="text-xl font-black text-cyan-400">{myClassicWinnings.toFixed(1)}</p>
                     </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-slate-400 text-[11px] font-black uppercase mb-2 tracking-wider">Active Round Position ({classicNextDrawCode})</p>
                    <div className="bg-[#050810] border border-slate-800 rounded-2xl p-3 max-h-[110px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
                      {myClassicTicketsThisRound.length === 0 ? (
                        <p className="text-slate-600 text-[11px] italic p-1">No positions taken in the active round yet.</p>
                      ) : (
                        myClassicTicketsThisRound.map(tIdx => (
                          <span key={tIdx} className="bg-cyan-500/10 text-cyan-400 text-[11px] font-mono font-bold px-2 py-1 rounded border border-cyan-500/20">
                            Ticket #{tIdx}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <p className="text-slate-400 text-[11px] font-black uppercase mb-2 tracking-wider">Past Payout Records</p>
                  <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                    {classicHistoricalWinners.filter(h => h.winner.toLowerCase() === wallet.toLowerCase()).length === 0 ? (
                      <p className="text-slate-600 text-sm italic text-center py-6">No classic win logs found for this wallet.</p>
                    ) : (
                      classicHistoricalWinners.filter(h => h.winner.toLowerCase() === wallet.toLowerCase()).map((h, i) => (
                        <div key={i} className="bg-[#0b1221] p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/10 flex justify-between items-center">
                          <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black text-[10px] uppercase px-2 py-1 rounded-full">{h.roundCode}</span>
                          <span className="text-emerald-400 text-sm font-black">+{h.prize} USDC</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        )}

      </div>

      {/* RAINBOWKIT STYLE WALLET SELECTOR */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#1a1b1f] border border-gray-800 rounded-[24px] max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="flex justify-between items-center p-5 border-b border-gray-800/50">
              <h3 className="text-lg font-bold text-white tracking-tight">Connect a Wallet</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div className="p-3 space-y-4 mt-2">
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-3">Installed</p>
                <button onClick={connectWallet} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-800/80 transition-colors group">
                  <div className="w-11 h-11 bg-white rounded-[14px] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-white font-bold text-[17px]">MetaMask</span>
                </button>
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-3 mt-1">Popular</p>
                <button onClick={connectWallet} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-800/80 transition-colors group">
                  <div className="w-11 h-11 bg-blue-500 rounded-[14px] flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  </div>
                  <span className="text-white font-bold text-[17px]">Browser Wallet</span>
                </button>
                <button onClick={connectWallet} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-800/80 transition-colors group">
                  <div className="w-11 h-11 bg-blue-600 rounded-[14px] flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <span className="text-white font-bold text-[17px]">Trust Wallet</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-800/30 flex justify-between items-center mt-2 border-t border-gray-800/50">
              <span className="text-gray-400 text-sm font-medium">New to Ethereum wallets?</span>
              <button className="text-blue-500 text-sm font-bold hover:text-blue-400 transition-colors">Learn More</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
