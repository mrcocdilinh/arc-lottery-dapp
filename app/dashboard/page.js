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

  // Blockchain States
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [nextDrawTime, setNextDrawTime] = useState(0);
  const [historicalWinners, setHistoricalWinners] = useState([]);

  // 1. Bulletproof Clock Pattern: Keeps ticking every 1s, completely unblocked by network requests
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const clock = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  // 2. Compute countdown string instantly in the render frame based on 'now' tick
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
      if (lastW !== "0x0000000000000000000000000000000000000000") {
        setWinner(lastW);
      }

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
      } catch (logErr) {
        console.error("Log fetch error:", logErr);
      }
    } catch (err) {
      console.error("Public Data Error:", err);
    }
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
          } else {
            localStorage.removeItem('connectedWalletType');
          }
        } catch (e) {
          console.error("Auto-reconnect failed", e);
        }
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
    if (!targetProvider) return alert(`No Web3 wallet extension detected!`);

    try {
      await targetProvider.request({ method: 'eth_requestAccounts' });
      const browserProvider = new ethers.BrowserProvider(targetProvider);
      const network = await browserProvider.getNetwork();
      
      if (Number(network.chainId) !== ARC_CHAIN_ID) {
        try {
          await targetProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ARC_CHAIN_ID_HEX }],
          });
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
    } catch (err) { alert(`Error: ${err.message || 'Connection failed'}`); }
  };

  const handleBuyTickets = async () => {
    if (!signerInstance) return alert('Please connect your wallet first!');
    try {
      setLoadingState('Sign in Wallet...');
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const totalCost = (0.1 * ticketCount).toFixed(1);
      
      const tx = await lotto.buyTickets(ticketCount, { value: ethers.parseEther(totalCost.toString()) });
      
      setLoadingState('Mining Block...');
      await tx.wait(); 
      
      alert(`Success! Purchased ${ticketCount} ticket(s).`);
      await fetchPublicData();
    } catch (err) {
      alert('Transaction failed or rejected.');
    } finally { setLoadingState(''); }
  };

  const handleDrawLottery = async () => {
    if (!signerInstance) return alert('Please connect your wallet first!');
    try {
      setLoadingState('Sign to Draw...');
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const tx = await lotto.drawLottery();
      
      setLoadingState('Mining Block...');
      await tx.wait();
      
      alert('Draw Successful! Prize sent automatically.');
      await fetchPublicData();
    } catch (err) {
      alert('Cannot Draw! Ensure timer is at 00:00 and players have bought tickets.');
    } finally { setLoadingState(''); }
  };

  const myTicketIndexes = playersList
    .map((p, index) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? index + 1 : null))
    .filter(index => index !== null);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 mt-4">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 mb-2 tracking-tight">
            ARC DECENTRALIZED LOTTERY
          </h1>
          <p className="text-slate-500 text-sm font-semibold tracking-widest uppercase">
            Fair, Transparent, and fully On-Chain
          </p>
        </div>

        <div className="flex justify-end mb-6">
          {wallet ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { navigator.clipboard.writeText(wallet); alert("Address Copied!"); }} className="bg-[#0f172a] hover:bg-[#1e293b] border border-slate-700/50 py-3 px-5 rounded-2xl font-mono text-sm shadow-xl font-bold text-cyan-400" title="Click to copy">
                🟢 {wallet.substring(0,6)}...{wallet.substring(38)}
              </button>
              <button onClick={() => { setWallet(''); setSignerInstance(null); localStorage.removeItem('connectedWalletType'); }} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-xl">
                Log Out
              </button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="bg-[#0f172a] hover:bg-[#1e293b] border border-slate-700/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl font-bold">
              🔌 Connect Web3 Wallet
            </button>
          )}
        </div>

        <div className="flex gap-2 p-1.5 bg-[#0f172a]/80 border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>⏱️ CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'mega' ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎯 MEGA 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'scratch' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎟️ SCRATCH CARDS</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'ledger' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>📜 TRANSPARENCY LEDGER</button>
        </div>

        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 mb-1">Hourly Classic Draw</h2>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-6">Ticket Price: 0.1 USDC</p>
                
                <div className="bg-[#05080f] border border-slate-800/50 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Time until next draw</p>
                  <div className={`text-3xl font-black font-mono tracking-wider ${timeLeft === 'READY TO DRAW!' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`}>
                    {timeLeft}
                  </div>
                </div>

                <div className="bg-gradient-to-b from-teal-950/20 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 mb-6 text-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Current Jackpot Pool</p>
                  <div className="text-4xl font-black text-emerald-400 tracking-tight">{poolBalance} <span className="text-lg font-medium">USDC</span></div>
                </div>

                <div className="flex items-center justify-between bg-[#05080f] py-4 px-6 rounded-xl border border-slate-800 mb-6">
                  <span className="text-slate-400 text-xs font-bold uppercase">Buy Quantity:</span>
                  <input 
                    type="number" min="1" value={ticketCount} 
                    onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-transparent text-white font-black text-2xl text-center w-24 outline-none"
                    style={{ appearance: 'textfield', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  />
                </div>
              </div>

              <div>
                <button onClick={handleBuyTickets} disabled={!!loadingState} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-xl transition-all mb-3 text-sm tracking-wider uppercase">
                  {loadingState ? loadingState : `Confirm Purchase (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button onClick={handleDrawLottery} disabled={!!loadingState} className={`w-full font-bold py-4 rounded-xl transition-all text-xs tracking-widest uppercase ${timeLeft === "READY TO DRAW!" ? "bg-amber-500 text-slate-900 hover:bg-amber-400 animate-pulse shadow-lg shadow-amber-500/20" : "bg-transparent border border-slate-700 hover:bg-slate-800 text-amber-500/50"}`}>
                  {timeLeft === "READY TO DRAW!" ? "🏆 Execute Draw & Payout Prize" : "Trigger Blockchain Draw"}
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col items-center justify-center text-center">
               <div className="text-7xl mb-4">🎫</div>
               <h3 className="text-xl font-bold text-slate-300 mb-2">Fair Play Guaranteed</h3>
               <p className="text-slate-500 text-sm">Our smart contracts utilize unmanipulable on-chain randomness. Funds are locked securely and distributed automatically to the winner. No manual claiming needed!</p>
            </div>
          </div>
        )}

        {activeTab === 'mega' && (
           <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl text-center animate-fadeIn">
             <h2 className="text-3xl font-black text-fuchsia-400 mb-2">Mega 6/45 Jackpot</h2>
             <p className="text-slate-500 text-sm mb-8">Select 6 lucky numbers. Match them all to win the grand multi-million pool. (Contract integration pending)</p>
           </div>
        )}

        {activeTab === 'scratch' && (
           <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
             <h2 className="text-3xl font-black text-amber-400 mb-2">Instant Scratch Cards</h2>
             <p className="text-slate-500 text-sm mb-12">Experience sub-second blockchain finality. Buy, scratch, and reveal your prize instantly.</p>
           </div>
        )}

        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-cyan-400">Current Round Ledger</h2>
                <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400">Total: {playersList.length} tickets</span>
              </div>
              <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Tickets awaiting draw:</p>
              <div className="bg-[#05080f] border border-slate-800/80 rounded-2xl p-4 overflow-y-auto h-[350px] space-y-2">
                {playersList.length === 0 ? (
                  <p className="text-slate-600 text-sm italic text-center mt-10">No tickets purchased in this round yet.</p>
                ) : (
                  playersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/50">
                      <span className="text-slate-400 text-xs font-bold">#{index + 1}</span>
                      <span className="text-cyan-400 font-mono text-xs truncate ml-2">{player}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-amber-400 mb-6">Past Winners History</h2>
              <div className="bg-[#05080f] border border-slate-800/80 rounded-2xl p-4 overflow-y-auto h-[380px] space-y-3">
                {historicalWinners.length === 0 ? (
                  <p className="text-slate-600 text-sm italic text-center mt-10">No past draws found or still syncing logs.</p>
                ) : (
                  historicalWinners.map((data, index) => (
                    <div key={index} className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-amber-500/80 text-xs uppercase font-black tracking-wide">🏆 Round Payout</span>
                        <span className="text-emerald-400 font-black text-sm">+{data.prize} USDC</span>
                      </div>
                      <div className="font-mono text-xs text-amber-400 truncate">Winner: {data.winner}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Select Wallet</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-500 hover:text-white font-bold text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <button onClick={() => connectWallet('okx')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">⬛ OKX Wallet</button>
              <button onClick={() => connectWallet('binance')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">🔶 Binance Web3</button>
              <button onClick={() => connectWallet('trust')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">🛡️ Trust Wallet</button>
              <button onClick={() => connectWallet('browser')} className="w-full bg-[#05080f] hover:bg-slate-800 border border-slate-800 py-4 px-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all">🦊 MetaMask / Extension</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}