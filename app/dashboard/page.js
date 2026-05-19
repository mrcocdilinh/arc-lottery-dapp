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
  "function lastDrawTime() public view returns (uint256)"
];

export default function Dashboard() {
  const [wallet, setWallet] = useState('');
  const [signerInstance, setSignerInstance] = useState(null);
  const [activeTab, setActiveTab] = useState('classic'); 
  const [loadingState, setLoadingState] = useState(''); 
  const [ticketCount, setTicketCount] = useState(1);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Mega 6/45 State
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  // Blockchain States
  const [poolBalance, setPoolBalance] = useState('0.0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [timeLeft, setTimeLeft] = useState('Syncing...');

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
    } catch (err) {
      console.error("Public Data Error:", err);
    }
  };

  useEffect(() => {
    fetchPublicData();

    const autoReconnect = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            setWallet(accounts[0]);
            setSignerInstance(signer);
          }
        } catch (e) {
          console.error("Auto-reconnect failed", e);
        }
      }
    };
    autoReconnect();

    const setupTimer = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
        const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const lastTime = await lotto.lastDrawTime();
        const nextDrawTime = Number(lastTime) + 3600; 
        
        const timer = setInterval(() => {
          const now = Math.floor(Date.now() / 1000);
          const diff = nextDrawTime - now;
          if (diff <= 0) {
            setTimeLeft("READY TO DRAW!");
          } else {
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            setTimeLeft(`${m}m ${s}s`);
          }
        }, 1000);
        return timer;
      } catch (err) {
        setTimeLeft("RPC Sync Error");
        return null;
      }
    };
    
    let intervalId;
    setupTimer().then(id => { intervalId = id; });
    return () => { if (intervalId) clearInterval(intervalId); };
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
            try {
              await targetProvider.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: ARC_CHAIN_ID_HEX,
                    chainName: 'Arc Testnet',
                    rpcUrls: [ARC_RPC_URL],
                    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                    blockExplorerUrls: ['https://explorer.testnet.arc.network'],
                  },
                ],
              });
            } catch (addError) { throw addError; }
          } else { throw switchError; }
        }
      }

      const updatedProvider = new ethers.BrowserProvider(targetProvider);
      const signer = await updatedProvider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(address);
      setSignerInstance(signer);
      setShowWalletModal(false);
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
      
      alert('Draw Successful!');
      await fetchPublicData();
    } catch (err) {
      alert('Draw condition not met yet (Timer not zero or Pool is empty).');
    } finally { setLoadingState(''); }
  };

  const toggleMegaNumber = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const myTicketIndexes = playersList
    .map((p, index) => (wallet && p.toLowerCase() === wallet.toLowerCase() ? index + 1 : null))
    .filter(index => index !== null);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        
        {/* Title Rebranded */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 mb-2 tracking-tight">
            ARC DECENTRALIZED LOTTERY
          </h1>
          <p className="text-slate-500 text-sm font-semibold tracking-widest uppercase">
            Fair, Transparent, and fully On-Chain
          </p>
        </div>

        {/* Connect button */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={() => wallet ? setWallet('') : setShowWalletModal(true)} 
            className="bg-[#0f172a] hover:bg-[#1e293b] border border-slate-700/50 py-3 px-6 rounded-2xl font-mono text-sm shadow-xl transition-all font-bold"
          >
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Connect Web3 Wallet'}
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex gap-2 p-1.5 bg-[#0f172a]/80 border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>⏱️ CLASSIC DRAW</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'mega' ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎯 MEGA 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'scratch' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>🎟️ SCRATCH CARDS</button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3 px-4 rounded-xl font-black text-sm tracking-wide transition-all whitespace-nowrap ${activeTab === 'ledger' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>📜 TRANSPARENCY LEDGER</button>
        </div>

        {/* Tab 1: Classic Lottery */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-cyan-400 mb-1">Hourly Classic Draw</h2>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-6">Ticket Price: 0.1 USDC</p>
                
                <div className="bg-[#05080f] border border-slate-800/50 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Time until next draw</p>
                  <div className="text-3xl font-black text-amber-400 font-mono tracking-wider">{timeLeft}</div>
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
                    className="bg-transparent text-white font-black text-2xl text-right w-24 outline-none"
                    style={{ appearance: 'textfield', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  />
                </div>
              </div>

              <div>
                <button 
                  onClick={handleBuyTickets} disabled={!!loadingState}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-xl transition-all mb-3 text-sm tracking-wider uppercase"
                >
                  {loadingState ? loadingState : `Confirm Purchase (${(0.1 * ticketCount).toFixed(1)} USDC)`}
                </button>
                <button 
                  onClick={handleDrawLottery} disabled={!!loadingState}
                  className="w-full bg-transparent border border-slate-700 hover:bg-slate-800 font-bold py-3 rounded-xl transition-all text-xs text-amber-400 uppercase tracking-widest"
                >
                  Trigger Blockchain Draw
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl flex flex-col items-center justify-center text-center">
               <div className="text-7xl mb-4">🎫</div>
               <h3 className="text-xl font-bold text-slate-300 mb-2">Fair Play Guaranteed</h3>
               <p className="text-slate-500 text-sm">Our smart contracts utilize unmanipulable on-chain randomness. Funds are locked securely and distributed automatically to the winner.</p>
            </div>
          </div>
        )}

        {/* Tab 2: Mega 6/45 */}
        {activeTab === 'mega' && (
           <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl text-center animate-fadeIn">
             <h2 className="text-3xl font-black text-fuchsia-400 mb-2">Mega 6/45 Jackpot</h2>
             <p className="text-slate-500 text-sm mb-8">Select 6 lucky numbers. Match them all to win the grand multi-million pool. (Contract integration pending)</p>
             
             <div className="grid grid-cols-5 md:grid-cols-9 gap-3 mb-8 max-w-2xl mx-auto">
               {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                 <button 
                   key={num} onClick={() => toggleMegaNumber(num)}
                   className={`aspect-square rounded-full font-bold text-lg flex items-center justify-center transition-all transform hover:scale-110 ${selectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/50 scale-110' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                 >
                   {num}
                 </button>
               ))}
             </div>
             <div className="bg-[#05080f] p-4 rounded-xl border border-slate-800 inline-block">
               <span className="text-slate-500 uppercase text-xs font-bold mr-4">Your Selection ({selectedNumbers.length}/6):</span>
               <span className="font-mono text-fuchsia-400 font-bold text-xl">{selectedNumbers.length > 0 ? selectedNumbers.sort((a,b)=>a-b).join(' - ') : '--'}</span>
             </div>
             
             <div className="mt-8">
               <button disabled className="bg-slate-800 text-slate-500 px-8 py-4 rounded-xl font-black tracking-wider uppercase cursor-not-allowed">
                 Submit Entry (Coming Soon)
               </button>
             </div>
           </div>
        )}

        {/* Tab 3: Scratch Cards */}
        {activeTab === 'scratch' && (
           <div className="bg-[#0f172a]/60 border border-slate-800 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
             <h2 className="text-3xl font-black text-amber-400 mb-2">Instant Scratch Cards</h2>
             <p className="text-slate-500 text-sm mb-12">Experience sub-second blockchain finality. Buy, scratch, and reveal your prize instantly.</p>
             
             <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-1.5 rounded-3xl w-72 h-72 cursor-pointer transform hover:rotate-2 hover:scale-105 transition-all shadow-2xl shadow-orange-500/20">
               <div className="bg-[#05080f] w-full h-full rounded-[20px] flex flex-col items-center justify-center border-4 border-dashed border-amber-500/30">
                 <span className="text-amber-500 font-black text-3xl uppercase tracking-widest mb-2">Scratch</span>
                 <span className="text-slate-600 font-bold text-sm uppercase">To Reveal</span>
               </div>
             </div>
             <p className="text-slate-500 text-xs uppercase tracking-widest mt-12 font-bold">Smart Contract Currently in Audit</p>
           </div>
        )}

        {/* Tab 4: Ledger & History */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            {/* Global History */}
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-emerald-400">Global Ledger</h2>
                <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400">Total: {playersList.length} tickets</span>
              </div>
              
              <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                <p className="text-amber-500/80 text-xs uppercase font-black mb-1 tracking-wide">👑 Previous Round Winner:</p>
                <div className="font-mono text-sm text-amber-400 break-all">{winner}</div>
              </div>

              <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Active Tickets (Current Round):</p>
              <div className="bg-[#05080f] border border-slate-800/80 rounded-2xl p-4 overflow-y-auto h-[250px] space-y-2">
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

            {/* My Tickets */}
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-emerald-400 mb-2">My Inventory</h2>
              <p className="text-slate-500 text-sm mb-6">Track your active entries.</p>

              {!wallet ? (
                <div className="bg-[#05080f] p-10 rounded-2xl border border-slate-800 text-center mt-10">
                  <p className="text-slate-400 mb-4 text-sm">Please connect your wallet to view history.</p>
                  <button onClick={() => setShowWalletModal(true)} className="bg-emerald-500 text-slate-900 font-bold py-2 px-6 rounded-lg text-sm">Connect Now</button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                      <p className="text-slate-500 text-xs font-bold uppercase">Total Owned</p>
                      <p className="text-3xl font-black text-white">{myTicketIndexes.length}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                      <p className="text-slate-500 text-xs font-bold uppercase">Win Chance</p>
                      <p className="text-3xl font-black text-emerald-400">
                        {playersList.length > 0 ? ((myTicketIndexes.length / playersList.length) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-500 text-xs uppercase font-black mb-3 tracking-wide">Your Ticket Numbers:</p>
                  {myTicketIndexes.length === 0 ? (
                    <div className="bg-[#05080f] p-6 rounded-2xl border border-slate-800 text-center">
                      <p className="text-slate-500 italic text-sm">You have 0 tickets in this round.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 md:grid-cols-4 gap-3 max-h-[150px] overflow-y-auto">
                      {myTicketIndexes.map(idx => (
                        <div key={idx} className="bg-emerald-500/10 border border-emerald-500/40 py-2 rounded-xl text-center font-black text-emerald-400 font-mono shadow-inner text-sm">
                          #{idx}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Wallet Modal Pop-up */}
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