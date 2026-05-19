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
  const [activeTab, setActiveTab] = useState('classic');
  const [loading, setLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Blockchain Data States
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [timeLeft, setTimeLeft] = useState('00m 00s');

  // Load public data immediately on page load to prevent Sync Errors
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
        const nextDrawTime = Number(lastTime) + 3600; // 1 hour interval
        
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
        console.error("Public RPC Sync Error:", err);
        setTimeLeft("Sync Error");
      }
    };
    fetchPublicData();
  }, []);

  // Multi-Wallet Connection Handler
  const connectWallet = async (walletType) => {
    let providerOptions = null;

    if (typeof window !== 'undefined') {
      if (walletType === 'metamask' && window.ethereum?.isMetaMask) {
        providerOptions = window.ethereum;
      } else if (walletType === 'trust' && window.trustwallet) {
        providerOptions = window.trustwallet;
      } else if (walletType === 'coinbase' && window.coinbaseWalletExtension) {
        providerOptions = window.coinbaseWalletExtension;
      } else if (walletType === 'browser' && window.ethereum) {
        providerOptions = window.ethereum;
      }
    }

    if (!providerOptions) {
      alert(`Selected wallet provider not found. Please install the extension!`);
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(providerOptions);
      await providerOptions.request({ method: 'eth_requestAccounts' });
      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(address);
      setSignerInstance(signer);
      setShowWalletModal(false);
      
      // Refresh data with the connected signer
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      const pList = await lotto.getPlayers();
      setPlayersList(pList);
    } catch (err) {
      console.error(err);
      alert('Wallet connection rejected or failed.');
    }
  };

  const handleBuyTickets = async () => {
    if (!signerInstance) return alert('Please connect your wallet first!');
    if (ticketCount < 1) return alert('Minimum ticket count is 1');

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
      window.location.reload(); // Quick refresh to update logs
    } catch (err) {
      console.error(err);
      alert('Transaction failed. Check your network or USDC balance.');
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
      alert('Lottery draw completed successfully!');
      window.location.reload();
    } catch (err) {
      alert('Draw conditions not met yet (Timer active or no players inside).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        
        {/* Header App */}
        <div className="text-center mb-10 mt-4">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-fuchsia-500 mb-3 tracking-tight">
            ARC GRAND CASINO
          </h1>
          <p className="text-slate-500 text-sm font-semibold tracking-widest uppercase">
            Decentralized & Verified On-Chain Lottery System
          </p>
        </div>

        {/* Dynamic Connect Button */}
        <div className="flex justify-end mb-8">
          <button 
            onClick={() => wallet ? setWallet('') : setShowWalletModal(true)} 
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl transition-all font-bold flex items-center gap-2"
          >
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Connect Wallet'}
          </button>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 px-6 rounded-xl font-black text-sm tracking-wide transition-all ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>⏱️ CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 px-6 rounded-xl font-black text-sm tracking-wide transition-all ${activeTab === 'mega' ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎯 MEGA 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 px-6 rounded-xl font-black text-sm tracking-wide transition-all ${activeTab === 'scratch' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎟️ SCRATCH CARD</button>
        </div>

        {/* Tab CONTENT 1: CLASSIC POOL */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            
            {/* Purchase Operations Panel */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 mb-1">Classic Hourly Draw</h2>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-6">Entry Fee: 0.1 USDC per ticket</p>
                
                <div className="bg-[#04060a] border border-slate-800/50 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Countdown to next draw</p>
                  <div className="text-3xl font-black text-amber-400 font-mono tracking-wider">{timeLeft}</div>
                </div>

                <div className="bg-gradient-to-b from-teal-950/20 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 mb-6 text-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Current Prize Pool</p>
                  <div className="text-4xl font-black text-emerald-400 tracking-tight">{poolBalance} <span className="text-lg font-medium">USDC</span></div>
                </div>

                <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800 mb-6">
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
                  {loading ? "PROCESSING TRANSACTION..." : `BUY TICKETS NOW (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button 
                  onClick={handleDrawLottery} disabled={loading}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 font-bold py-3 rounded-xl transition-all text-xs tracking-wide"
                >
                  TRIGGER LUCKY DRAW
                </button>
              </div>
            </div>

            {/* Transparency Ledger Panel */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col">
              <h2 className="text-xl font-black text-fuchsia-400 mb-6 uppercase tracking-wider">Transparency Ledger</h2>
              
              <div className="mb-6">
                <p className="text-slate-500 text-xs uppercase font-black mb-2 tracking-wide">🏆 Historical Last Winner:</p>
                <div className="bg-slate-950 p-3 rounded-xl font-mono text-xs text-amber-400 border border-slate-800/60 truncate">
                  {winner}
                </div>
              </div>

              <p className="text-slate-500 text-xs uppercase font-black mb-2 tracking-wide">🎫 Active Tickets In Pool ({playersList.length}):</p>
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex-1 overflow-y-auto max-h-[260px] space-y-2">
                {playersList.length === 0 ? (
                  <p className="text-slate-600 text-xs italic text-center mt-12">No active tickets for this round yet.</p>
                ) : (
                  playersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0d1321] p-2.5 rounded-lg border border-slate-800/30 text-xs font-mono">
                      <span className="text-slate-500">Index #{index + 1}</span>
                      <span className="text-cyan-400 font-semibold">{player.substring(0,10)}...{player.substring(34)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: MEGA 6/45 PLACEHOLDER */}
        {activeTab === 'mega' && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8 shadow-2xl text-center border-dashed">
            <h2 className="text-3xl font-black text-fuchsia-400 mb-2">MEGA 6/45 BLOCKCHAIN</h2>
            <p className="text-slate-500 text-sm mb-8">Pick 6 numbers out of 45. Multi-million pool mechanics coming soon.</p>
            <div className="grid grid-cols-5 md:grid-cols-9 gap-2.5 max-w-xl mx-auto opacity-40 pointer-events-none">
              {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                <div key={num} className="aspect-square bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-400">{num}</div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SCRATCH CARD PLACEHOLDER */}
        {activeTab === 'scratch' && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8 shadow-2xl text-center border-dashed flex flex-col items-center">
            <h2 className="text-3xl font-black text-amber-400 mb-2">INSTANT SCRATCH CARDS</h2>
            <p className="text-slate-500 text-sm mb-8">Sub-second execution speeds powered by cryptographic proof vectors.</p>
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 p-1 rounded-2xl w-48 h-48 border border-slate-800 flex items-center justify-center opacity-50">
              <span className="text-slate-500 font-black uppercase text-xs tracking-widest">Locked Matrix</span>
            </div>
          </div>
        )}

      </div>

      {/* Multi-Wallet Choice Selection Modal Pop-up */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xs w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white">Select Wallet</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-500 hover:text-white font-bold text-sm">✕</button>
            </div>
            <div className="space-y-2.5">
              <button onClick={() => connectWallet('metamask')} className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition-all">🦊 MetaMask</button>
              <button onClick={() => connectWallet('trust')} className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition-all">🛡️ Trust Wallet</button>
              <button onClick={() => connectWallet('coinbase')} className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition-all">🔵 Coinbase Wallet</button>
              <button onClick={() => connectWallet('browser')} className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition-all">🌐 Browser Extension</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}