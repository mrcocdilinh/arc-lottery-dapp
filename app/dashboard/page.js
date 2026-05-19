'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x_PASTE_YOUR_NEW_CONTRACT_ADDRESS_HERE";
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
  const [activeTab, setActiveTab] = useState('buy'); 
  const [loading, setLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Blockchain Data
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [timeLeft, setTimeLeft] = useState('Syncing...');

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
            setTimeLeft("READY TO DRAW!");
            clearInterval(timer);
          } else {
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            setTimeLeft(`${m}m ${s}s`);
          }
        }, 1000);

        return () => clearInterval(timer);
      } catch (err) {
        setTimeLeft("RPC Sync Error");
      }
    };
    fetchPublicData();
  }, []);

  // Smart Multi-Wallet Connector
  const connectWallet = async (walletType) => {
    let targetProvider = null;

    if (typeof window !== 'undefined') {
      if (walletType === 'okx' && window.okxwallet) targetProvider = window.okxwallet;
      else if (walletType === 'binance' && window.BinanceChain) targetProvider = window.BinanceChain;
      else if (walletType === 'trust' && window.trustwallet) targetProvider = window.trustwallet;
      
      // Smart Fallback: If specific wallet not found, force use standard window.ethereum
      if (!targetProvider && window.ethereum) {
        targetProvider = window.ethereum;
      }
    }

    if (!targetProvider) {
      alert(`No Web3 wallet detected! Please install an extension.`);
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
      console.error(err);
      alert(`Connection Error: ${err.message || 'Request rejected'}`);
    }
  };

  const handleBuyTickets = async () => {
    if (!signerInstance) return alert('Please connect your wallet first!');
    if (ticketCount < 1) return alert('Minimum ticket quantity is 1');

    setLoading(true);
    try {
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const costPerTicket = 0.1;
      const totalCost = (costPerTicket * ticketCount).toFixed(1);
      
      const tx = await lotto.buyTickets(ticketCount, {
        value: ethers.parseEther(totalCost.toString())
      });
      await tx.wait();
      
      alert(`Success! Purchased ${ticketCount} ticket(s).`);
      window.location.reload(); 
    } catch (err) {
      alert(`Transaction failed: ${err.message || 'Check USDC balance'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrawLottery = async () => {
    if (!signerInstance) return alert('Please connect your wallet first!');
    setLoading(true);
    try {
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      const tx = await lotto.drawLottery();
      await tx.wait();
      alert('Draw Successful! Prize distributed.');
      window.location.reload();
    } catch (err) {
      alert('Draw condition not met (Timer or Empty Pool).');
    } finally {
      setLoading(false);
    }
  };

  const myTicketIndexes = playersList
    .map((p, index) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? index + 1 : null))
    .filter(index => index !== null);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2 tracking-tight">
            ARC GRAND CASINO
          </h1>
          <p className="text-slate-500 text-sm font-semibold tracking-widest uppercase">
            100% Transparent On-Chain Ecosystem
          </p>
        </div>

        {/* Connect Button */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={() => wallet ? setWallet('') : setShowWalletModal(true)} 
            className="bg-[#0f172a] hover:bg-[#1e293b] border border-slate-700/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl transition-all font-bold flex items-center gap-2"
          >
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Connect Web3 Wallet'}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1.5 bg-[#0f172a]/80 border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
          <button onClick={() => setActiveTab('buy')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'buy' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🛒 BUY TICKETS</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>📜 GLOBAL HISTORY</button>
          <button onClick={() => setActiveTab('my-tickets')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'my-tickets' ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎫 MY TICKETS</button>
        </div>

        {/* TAB 1: BUY TICKETS */}
        {activeTab === 'buy' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 mb-1">Arc Classic</h2>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-6">Price: 0.1 USDC / Ticket</p>
                
                <div className="bg-[#05080f] border border-slate-800/50 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Next Draw Countdown</p>
                  <div className="text-3xl font-black text-amber-400 font-mono tracking-wider">{timeLeft}</div>
                </div>

                <div className="bg-gradient-to-b from-teal-950/20 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 mb-6 text-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Current Prize Pool</p>
                  <div className="text-4xl font-black text-emerald-400 tracking-tight">{poolBalance} <span className="text-lg font-medium">USDC</span></div>
                </div>

                <div className="flex items-center gap-4 bg-[#05080f] p-3 rounded-xl border border-slate-800 mb-6">
                  <span className="text-slate-400 text-xs font-bold uppercase pl-2">Quantity:</span>
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
                  {loading ? "PROCESSING TX..." : `CONFIRM PURCHASE (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button 
                  onClick={handleDrawLottery} disabled={loading}
                  className="w-full bg-transparent border border-slate-700 hover:bg-slate-800 font-bold py-3 rounded-xl transition-all text-xs tracking-wide text-amber-400"
                >
                  TRIGGER LUCKY DRAW
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col items-center justify-center text-center">
               <div className="text-7xl mb-4">🎰</div>
               <h3 className="text-xl font-bold text-slate-300 mb-2">Smart Contract Security</h3>
               <p className="text-slate-500 text-sm">All draw algorithms and fund distributions are processed on-chain. Zero house manipulation risk. Verifiable on Arc Explorer.</p>
            </div>
          </div>
        )}

        {/* TAB 2: GLOBAL HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-fuchsia-400">Global Ledger</h2>
              <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400">Total: {playersList.length} tickets</span>
            </div>
            
            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
              <p className="text-amber-500/80 text-xs uppercase font-black mb-1 tracking-wide">👑 Previous Round Winner:</p>
              <div className="font-mono text-sm text-amber-400 break-all">{winner}</div>
            </div>

            <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Active Tickets (Current Round):</p>
            <div className="bg-[#05080f] border border-slate-800/80 rounded-2xl p-4 overflow-y-auto max-h-[400px] space-y-2">
              {playersList.length === 0 ? (
                <p className="text-slate-600 text-sm italic text-center mt-10 mb-10">No tickets purchased in this round yet.</p>
              ) : (
                playersList.map((player, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/50 hover:border-slate-600 transition-colors">
                    <span className="text-slate-400 text-sm font-bold mb-1 sm:mb-0">Ticket #{index + 1}</span>
                    <span className="text-cyan-400 font-mono text-xs sm:text-sm break-all">{player}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MY TICKETS */}
        {activeTab === 'my-tickets' && (
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-emerald-400 mb-2">My Inventory</h2>
            <p className="text-slate-500 text-sm mb-6">Track your active ticket entries for the current draw.</p>

            {!wallet ? (
              <div className="bg-[#05080f] p-10 rounded-2xl border border-slate-800 text-center">
                <p className="text-slate-400 mb-4">Please connect your wallet to view history.</p>
                <button onClick={() => setShowWalletModal(true)} className="bg-emerald-500 text-slate-900 font-bold py-2 px-6 rounded-lg">Connect Now</button>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase">Total Owned</p>
                    <p className="text-3xl font-black text-white">{myTicketIndexes.length}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase">Win Probability</p>
                    <p className="text-3xl font-black text-emerald-400">
                      {playersList.length > 0 ? ((myTicketIndexes.length / playersList.length) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Your Ticket Numbers:</p>
                {myTicketIndexes.length === 0 ? (
                  <div className="bg-[#05080f] p-8 rounded-2xl border border-slate-800 text-center">
                    <p className="text-slate-500 italic">You have 0 tickets in this round.</p>
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

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Select Wallet</h3>
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
                <span className="text-2xl">🦊</span> MetaMask / Injected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}