'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CLASSIC_ADDRESS = "0xE0F2C50E2F2A6F91A02De6d9C398088113d9f5B0";
const MEGA_ADDRESS = "0x9A394437782F422C0B04416deCC21cDce0392bA4";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4CEF52";

const CLASSIC_ABI = ["function buyTickets(uint256 numberOfTickets) public payable","function drawLottery() public","function recentWinner() public view returns (address)","function getPlayers() public view returns (address[])","function getPoolBalance() public view returns (uint256)","function lastDrawTime() public view returns (uint256)","event WinnerPicked(address indexed winner, uint256 prizeAmount)"];
const MEGA_ABI = ["function buyTicket(uint8 n1, uint8 n2, uint8 n3) public payable","function drawJackpot() public","function jackpotPool() public view returns (uint256)","function seedPool() public view returns (uint256)","function currentRound() public view returns (uint256)","function lastDrawTime() public view returns (uint256)","function getTicketsCount(uint256 round) public view returns (uint256)","event TicketBought(address indexed player, uint256 round, uint8[3] numbers)","event JackpotWon(uint256 indexed round, uint8[3] winningNumbers, uint256 winnersCount, uint256 prizePerWinner)","event NoWinner(uint256 indexed round, uint8[3] winningNumbers, uint256 rolledOverAmount)"];

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

  const [classicTicketCount, setClassicTicketCount] = useState(1);
  const [classicPoolBalance, setClassicPoolBalance] = useState('0.0');
  const [classicPlayersList, setClassicPlayersList] = useState([]);
  const [classicHistoricalWinners, setClassicHistoricalWinners] = useState([]);
  const [classicNextDrawTime, setClassicNextDrawTime] = useState(0);

  const [megaSelectedNumbers, setMegaSelectedNumbers] = useState([]);
  const [megaPoolBalance, setMegaPoolBalance] = useState('0.0');
  const [megaSeedPoolBalance, setMegaSeedPoolBalance] = useState('0.0');
  const [megaCurrentRound, setMegaCurrentRound] = useState(1);
  const [megaTicketsCountThisRound, setMegaTicketsCountThisRound] = useState(0);
  const [megaHistoryLogs, setMegaHistoryLogs] = useState([]);
  const [myMegaTickets, setMyMegaTickets] = useState([]); // Lưu vé cá nhân

  // Đồng hồ hệ thống Real-time
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Tính toán giờ Classic (Dựa vào Smart Contract)
  const diffClassic = classicNextDrawTime - Math.floor(now / 1000);
  let classicTimeLeft = classicNextDrawTime > 0 ? (diffClassic <= 0 ? "READY TO DRAW!" : `${Math.floor(diffClassic / 60).toString().padStart(2, '0')}m ${(diffClassic % 60).toString().padStart(2, '0')}s`) : "Syncing...";

  // TÍNH TOÁN GIỜ MEGA: Cố định đúng giờ chẵn UTC (XX:00:00)
  const currentUtc = new Date(now);
  const nextUtcHour = new Date(currentUtc);
  nextUtcHour.setUTCHours(currentUtc.getUTCHours() + 1, 0, 0, 0);
  const diffMega = Math.floor((nextUtcHour.getTime() - currentUtc.getTime()) / 1000);
  let megaTimeLeft = diffMega <= 0 ? "READY TO DRAW!" : `${Math.floor(diffMega / 60).toString().padStart(2, '0')}m ${(diffMega % 60).toString().padStart(2, '0')}s`;

  const fetchData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      
      // Fetch Classic
      const classic = new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, provider);
      setClassicPoolBalance(ethers.formatEther(await classic.getPoolBalance()));
      setClassicPlayersList(await classic.getPlayers());
      setClassicNextDrawTime(Number(await classic.lastDrawTime()) + 3600);
      const cEvents = await classic.queryFilter(classic.filters.WinnerPicked(), -10000);
      setClassicHistoricalWinners(cEvents.map((e, i) => ({ round: i + 1, winner: e.args[0], prize: ethers.formatEther(e.args[1]) })).reverse());

      // Fetch Mega
      const mega = new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, provider);
      setMegaPoolBalance(ethers.formatEther(await mega.jackpotPool()));
      setMegaSeedPoolBalance(ethers.formatEther(await mega.seedPool()));
      const mRound = await mega.currentRound();
      setMegaCurrentRound(Number(mRound));
      setMegaTicketsCountThisRound(Number(await mega.getTicketsCount(mRound)));

      // Lịch sử Mega Toàn Cầu
      const won = await mega.queryFilter(mega.filters.JackpotWon(), -10000);
      const no = await mega.queryFilter(mega.filters.NoWinner(), -10000);
      const history = [
        ...won.map(e => ({ round: Number(e.args[0]), winningNumbers: e.args[1].join('-'), status: 'WIN', prize: ethers.formatEther(e.args[3]), details: `${Number(e.args[2])} Winners` })),
        ...no.map(e => ({ round: Number(e.args[0]), winningNumbers: e.args[1].join('-'), status: 'ROLLOVER', prize: ethers.formatEther(e.args[2]), details: `Rollover` }))
      ].sort((a,b) => b.round - a.round);
      setMegaHistoryLogs(history);

      // Lịch sử Vé Cá Nhân của Ví đang kết nối
      if (wallet) {
        const myTicketLogs = await mega.queryFilter(mega.filters.TicketBought(wallet), -10000);
        setMyMegaTickets(myTicketLogs.map(e => ({
          round: Number(e.args[1]),
          numbers: e.args[2].join(' - ')
        })).reverse());
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, [wallet]);

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
          if (e.code === 4902) { await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX, chainName: 'Arc Testnet', rpcUrls: [ARC_RPC_URL], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://explorer.testnet.arc.network'] }] }); } else { throw e; }
        }
      }
      const signer = await new ethers.BrowserProvider(targetProvider).getSigner();
      setWallet(await signer.getAddress());
      setSignerInstance(signer);
      setShowWalletModal(false);
      localStorage.setItem('connectedWalletType', walletType);
      showToast("Wallet connected!", "success");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleBuyClassic = async () => {
    if (!signerInstance) return showToast('Connect wallet!', 'error');
    try {
      setLoadingState('Mining...');
      const tx = await new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance).buyTickets(classicTicketCount, { value: ethers.parseEther((0.1 * classicTicketCount).toString()) });
      await tx.wait();
      showToast('Success!', 'success');
      fetchData();
    } catch { showToast('Error', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawClassic = async () => {
    if (!signerInstance) return showToast('Connect wallet!', 'error');
    try {
      setLoadingState('Mining...');
      await (await new ethers.Contract(CLASSIC_ADDRESS, CLASSIC_ABI, signerInstance).drawLottery()).wait();
      showToast('Draw Executed!', 'success');
      fetchData();
    } catch { showToast('Error or not time yet.', 'error'); } finally { setLoadingState(''); }
  };

  const handleBuyMega = async () => {
    if (!signerInstance) return showToast('Connect wallet!', 'error');
    if (megaSelectedNumbers.length !== 3) return showToast('Select 3 numbers!', 'error');
    try {
      setLoadingState('Mining...');
      const sorted = [...megaSelectedNumbers].sort((a, b) => a - b);
      const tx = await new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance).buyTicket(sorted[0], sorted[1], sorted[2], { value: ethers.parseEther("1.0") });
      await tx.wait();
      showToast('Ticket Bought!', 'success');
      setMegaSelectedNumbers([]);
      fetchData();
    } catch { showToast('Error', 'error'); } finally { setLoadingState(''); }
  };

  const handleDrawMega = async () => {
    if (!signerInstance) return showToast('Connect wallet!', 'error');
    try {
      setLoadingState('Mining...');
      await (await new ethers.Contract(MEGA_ADDRESS, MEGA_ABI, signerInstance).drawJackpot()).wait();
      showToast('Mega Draw Executed!', 'success');
      fetchData();
    } catch { showToast('Error or not time yet.', 'error'); } finally { setLoadingState(''); }
  };

  const toggleMegaNumber = (num) => {
    if (megaSelectedNumbers.includes(num)) setMegaSelectedNumbers(megaSelectedNumbers.filter(n => n !== num));
    else if (megaSelectedNumbers.length < 3) setMegaSelectedNumbers([...megaSelectedNumbers, num]);
  };
return (
    <div className="min-h-screen bg-[#050810] text-white p-4 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {notification.show && (
        <div className="fixed top-8 left-0 right-0 flex justify-center z-[100] animate-fadeIn">
          <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 ${notification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'}`}>
            <p className="font-bold text-sm tracking-wide">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-10 mt-6">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-3 tracking-tighter">ARC LOTTERY</h1>
          <p className="text-cyan-400/80 text-sm font-bold tracking-[0.3em] uppercase">Fair • Transparent • On-Chain</p>
        </div>

        <div className="flex justify-end mb-8">
          {wallet ? (
            <div className="flex items-center gap-3">
              <button className="bg-[#0b1221] border border-cyan-900/50 py-3 px-6 rounded-2xl font-mono text-sm font-bold text-cyan-400">{wallet.substring(0,6)}...{wallet.substring(38)}</button>
              <button onClick={() => { setWallet(''); setSignerInstance(null); localStorage.removeItem('connectedWalletType'); }} className="bg-rose-500/10 text-rose-400 py-3 px-5 rounded-2xl font-bold text-sm">Log Out</button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="bg-gradient-to-r from-cyan-600 to-blue-700 py-3 px-8 rounded-2xl font-mono text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]">Connect Wallet</button>
          )}
        </div>

        <div className="flex gap-3 p-2 bg-[#0b1221]/80 backdrop-blur-md border border-slate-800/80 rounded-3xl mb-10 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all ${activeTab === 'classic' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-500'}`}>⏱️ CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all ${activeTab === 'mega' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30' : 'text-slate-500'}`}>🎯 MEGA JACKPOT 3/45</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm transition-all ${activeTab === 'ledger' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-500'}`}>📜 HISTORY & TICKETS</button>
        </div>

        {/* TAB 1: CLASSIC */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col group">
              <div>
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
                <button onClick={handleBuyClassic} disabled={!!loadingState} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black py-4 rounded-2xl shadow-md uppercase">{loadingState ? loadingState : `Confirm Purchase (${(0.1 * classicTicketCount).toFixed(1)} USDC)`}</button>
                <button onClick={handleDrawClassic} disabled={!!loadingState} className="w-full bg-transparent border border-slate-800 text-slate-500 font-bold py-4 rounded-2xl text-sm uppercase">Trigger Blockchain Draw</button>
              </div>
            </div>

            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col h-full min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Live Network</h2>
                <span className="bg-[#050810] border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-300">Total: {classicPlayersList.length} tickets</span>
              </div>
              <div className="bg-[#050810] border border-slate-800/80 rounded-3xl p-4 overflow-y-auto max-h-[350px] flex-1 space-y-3 custom-scrollbar">
                {classicPlayersList.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-10">No tickets yet.</p> : classicPlayersList.map((player, index) => (
                  <div key={index} className="flex justify-between items-center bg-[#0b1221] p-4 rounded-2xl border border-slate-800/50"><span className="text-slate-500 text-xs font-black">#{index + 1}</span><span className="text-cyan-400 font-mono text-sm">{player.substring(0,10)}...</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEGA */}
        {activeTab === 'mega' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col group">
              <div>
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
                    <span className="text-slate-400 text-xs font-bold uppercase">Total Accumulated Jackpot</span>
                    <span className="text-emerald-400 font-black text-2xl">{megaPoolBalance} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Seed Pool (Next Round Backup):</span>
                    <span className="text-teal-400 font-bold">{megaSeedPoolBalance} USDC</span>
                  </div>
                </div>

                <p className="text-xs font-bold uppercase text-slate-400 mb-3">Select exactly 3 numbers ({megaSelectedNumbers.length}/3):</p>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 p-3 bg-[#050810] rounded-2xl max-h-[180px] overflow-y-auto border border-slate-800/80 mb-6 custom-scrollbar">
                  {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                    <button key={num} onClick={() => toggleMegaNumber(num)} className={`py-2 rounded-xl text-xs font-black transition-all ${megaSelectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>{num.toString().padStart(2, '0')}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 mt-auto">
                <div className="bg-[#050810] p-4 rounded-xl border border-slate-800 text-center text-sm font-bold text-fuchsia-400 font-mono">
                  Your Pick: {megaSelectedNumbers.length > 0 ? megaSelectedNumbers.sort((a,b)=>a-b).join(' - ') : 'None'}
                </div>
                <button onClick={handleBuyMega} disabled={!!loadingState || megaSelectedNumbers.length !== 3} className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 disabled:from-slate-800 disabled:to-slate-900 text-white font-black py-4 rounded-2xl uppercase text-sm">
                  {loadingState ? loadingState : "Confirm Purchase (1.0 USDC)"}
                </button>
                <button onClick={handleDrawMega} disabled={!!loadingState} className="w-full bg-transparent border border-slate-800 text-slate-500 font-bold py-3 rounded-2xl text-xs uppercase">Trigger Mega Draw</button>
              </div>
            </div>

            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 shadow-2xl flex flex-col justify-center items-center text-center">
               <h3 className="text-2xl font-bold text-fuchsia-400 mb-4">ROLLOVER MECHANICS</h3>
               <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">Draws happen exactly on the UTC hour mark. 80% goes to Jackpot. If there's no winner, the Jackpot rolls over to the next round, growing infinitely until someone hits it!</p>
               <div className="bg-[#050810] px-6 py-3 rounded-full border border-slate-800 text-xs font-mono font-bold text-slate-400">Tickets bought this round: <span className="text-fuchsia-400">{megaTicketsCountThisRound}</span></div>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY & LEDGER */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Lịch sử cá nhân - MEGA TICKETS */}
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col">
              <h2 className="text-2xl font-black text-fuchsia-400 mb-2">My Mega Tickets</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Lịch sử số bạn đã chọn</p>
              <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto max-h-[450px] flex-1 space-y-3 custom-scrollbar">
                {!wallet ? <p className="text-slate-600 text-sm italic text-center py-20">Connect wallet to view.</p> : myMegaTickets.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-20">No Mega tickets bought.</p> : myMegaTickets.map((t, index) => (
                  <div key={index} className="bg-[#0b1221] p-4 rounded-xl border border-slate-800/80 flex justify-between items-center">
                    <span className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 font-black text-[10px] uppercase px-3 py-0.5 rounded-full">Round #{t.round}</span>
                    <span className="font-mono text-white font-bold">{t.numbers}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lịch sử chung - GLOBAL MEGA HISTORY */}
            <div className="bg-[#0b1221]/70 border border-slate-800 rounded-[40px] p-8 flex flex-col">
              <h2 className="text-2xl font-black text-amber-400 mb-2">Global Mega History</h2>
              <p className="text-slate-500 text-xs mb-4 uppercase font-bold">Lịch sử nổ hũ / Cộng dồn toàn mạng</p>
              <div className="bg-[#050810] border border-slate-800 rounded-3xl p-4 overflow-y-auto max-h-[450px] flex-1 space-y-3 custom-scrollbar">
                {megaHistoryLogs.length === 0 ? <p className="text-slate-600 text-sm italic text-center py-20">No draws yet.</p> : megaHistoryLogs.map((log, index) => (
                  <div key={index} className={`bg-[#0b1221] p-4 rounded-xl border flex flex-col gap-2 ${log.status === 'WIN' ? 'border-emerald-500/30' : 'border-amber-500/20'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase px-3 py-0.5 rounded-full border ${log.status === 'WIN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>Round #{log.round} - {log.status}</span>
                      <span className={`font-black text-md ${log.status === 'WIN' ? 'text-emerald-400' : 'text-amber-400'}`}>{log.status === 'WIN' ? `Each: +${log.prize} USDC` : `Pool: ${log.prize} USDC`}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-mono">Numbers: <span className="text-white font-bold">{log.winningNumbers}</span></span>
                      <span className="text-slate-500 italic text-[11px]">{log.details}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {showWalletModal && (
        <div className="fixed inset-0 bg-[#050810]/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1221] border border-slate-700/50 rounded-[40px] max-w-sm w-full p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white">Connect</h3>
              <button onClick={() => setShowWalletModal(false)} className="bg-[#050810] text-slate-400 w-10 h-10 rounded-full font-bold">✕</button>
            </div>
            <div className="space-y-4">
              <button onClick={() => connectWallet('browser')} className="w-full bg-[#050810] border border-slate-800 py-4 px-6 rounded-2xl text-sm font-bold">Browser Extension</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}