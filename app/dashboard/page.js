'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// 👇 PASTE YOUR NEW CONTRACT ADDRESS HERE 👇
const CONTRACT_ADDRESS = "0xdad24AF23b4d5aDce5D0120cAD5208c9EA178850";

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
  const [contract, setContract] = useState(null);
  const [activeTab, setActiveTab] = useState('classic');
  const [loading, setLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState(1); // For multiple tickets

  const [poolBalance, setPoolBalance] = useState('0');
  const [playersList, setPlayersList] = useState([]);
  const [winner, setWinner] = useState('None');
  const [timeLeft, setTimeLeft] = useState('Loading...');

  // Mega 6/45 UI States
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);

        const lotto = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(lotto);
        await updateData(lotto);
      } catch (err) { alert('Connection failed!'); }
    } else { alert('Please install MetaMask!'); }
  };

  const updateData = async (lotto) => {
    try {
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      
      const pList = await lotto.getPlayers();
      setPlayersList(pList);
      
      const lastW = await lotto.recentWinner();
      if(lastW !== "0x0000000000000000000000000000000000000000") setWinner(lastW);

      const lastTime = await lotto.lastDrawTime();
      const nextDrawTime = Number(lastTime) + 3600; 
      
      const interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const diff = nextDrawTime - now;
        if (diff <= 0) {
          setTimeLeft("READY TO DRAW!");
          clearInterval(interval);
        } else {
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          setTimeLeft(`${m}m ${s}s`);
        }
      }, 1000);
    } catch (err) { 
      console.error(err);
      setTimeLeft("Sync Error");
    }
  };

  const buyTickets = async () => {
    if (!contract) return alert('Please connect wallet first!');
    if (ticketCount < 1) return alert('Must buy at least 1 ticket');
    
    setLoading(true);
    try {
      const totalCost = (0.1 * ticketCount).toFixed(1);
      const tx = await contract.buyTickets(ticketCount, { value: ethers.parseEther(totalCost.toString()) });
      await tx.wait();
      alert(`Successfully purchased ${ticketCount} ticket(s)!`);
      await updateData(contract);
    } catch (err) { 
      alert('Transaction failed! Check your USDC balance.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const drawLottery = async () => {
    if (!contract) return alert('Please connect wallet first!');
    setLoading(true);
    try {
      const tx = await contract.drawLottery();
      await tx.wait();
      alert('Draw complete! Prize sent to the winner.');
      await updateData(contract);
    } catch (err) { 
      alert('Cannot draw yet! Check timer or player pool.'); 
    } finally {
      setLoading(false);
    }
  };

  const toggleMegaNumber = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-3">ARC GRAND CASINO</h1>
          <p className="text-slate-400 text-lg uppercase tracking-widest text-sm">100% Transparent On-Chain Lottery</p>
        </div>

        <div className="flex justify-end mb-6">
          <button onClick={connectWallet} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 py-3 px-6 rounded-xl font-mono shadow-lg transition">
            {wallet ? `🟢 ${wallet.substring(0,6)}...${wallet.substring(38)}` : '🔌 Connect MetaMask'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-slate-800/80 rounded-2xl mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('classic')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'classic' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>⏱️ Classic Draw</button>
          <button onClick={() => setActiveTab('mega')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'mega' ? 'bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>🎯 Mega 6/45</button>
          <button onClick={() => setActiveTab('scratch')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'scratch' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>🎟️ Scratch Card</button>
        </div>

        {/* TAB 1: CLASSIC */}
        {activeTab === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">Classic Pool (0.1 USDC)</h2>
              
              <div className="bg-slate-900 rounded-2xl p-4 mb-6 border border-slate-700 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest">Next Draw In</p>
                <div className="text-2xl font-black text-amber-400 font-mono">{timeLeft}</div>
              </div>

              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 mb-6 text-center">
                <p className="text-slate-400 text-sm mb-2 uppercase">Current Prize Pool</p>
                <div className="text-4xl font-black text-emerald-400">{poolBalance} USDC</div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 flex-1 flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Tickets:</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={ticketCount} 
                    onChange={(e) => setTicketCount(Number(e.target.value))}
                    className="bg-transparent text-white font-bold text-right w-16 outline-none"
                  />
                </div>
                <div className="text-cyan-400 font-bold">
                  Total: {(0.1 * ticketCount).toFixed(1)} USDC
                </div>
              </div>

              <button onClick={buyTickets} disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all mb-4">
                {loading ? "PROCESSING..." : "BUY TICKETS NOW"}
              </button>

              <button onClick={drawLottery} disabled={loading} className="w-full bg-slate-700 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all text-sm border border-slate-600">
                 ACTIVATE DRAW
              </button>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col">
              <h2 className="text-xl font-bold text-fuchsia-400 mb-4">Transparency Ledger</h2>
              
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-2 uppercase font-bold">👑 Last Winner:</p>
                <div className="bg-slate-900 p-3 rounded-xl font-mono text-xs text-amber-400 border border-slate-700 truncate">
                  {winner}
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-2 uppercase font-bold">🎫 Current Tickets ({playersList.length}):</p>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex-1 overflow-y-auto max-h-[250px] space-y-2">
                {playersList.length === 0 ? (
                  <p className="text-slate-500 text-sm italic text-center mt-4">Pool is empty.</p>
                ) : (
                  playersList.map((player, index) => (
                    <div key={index} className="flex justify-between items-center bg-slate-800 p-2 rounded text-xs font-mono">
                      <span className="text-slate-400">Ticket #{index + 1}</span>
                      <span className="text-cyan-300">{player.substring(0,8)}...{player.substring(36)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEGA 6/45 */}
        {activeTab === 'mega' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center">
            <h2 className="text-3xl font-bold text-fuchsia-400 mb-2">Mega 6/45</h2>
            <p className="text-slate-400 mb-8">Select 6 numbers to win the Jackpot. (UI Demo)</p>
            
            <div className="grid grid-cols-5 md:grid-cols-9 gap-3 mb-8 max-w-2xl mx-auto">
              {Array.from({length: 45}, (_, i) => i + 1).map(num => (
                <button 
                  key={num} onClick={() => toggleMegaNumber(num)}
                  className={`aspect-square rounded-full font-bold flex items-center justify-center transition-all ${selectedNumbers.includes(num) ? 'bg-fuchsia-500 text-white scale-110 shadow-lg shadow-fuchsia-500/50' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 inline-block">
              <span className="text-slate-400 mr-4">Selected ({selectedNumbers.length}/6):</span>
              <span className="font-mono text-fuchsia-400 font-bold text-xl">{selectedNumbers.sort((a,b)=>a-b).join(' - ') || '--'}</span>
            </div>
          </div>
        )}

        {/* TAB 3: SCRATCH */}
        {activeTab === 'scratch' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
            <h2 className="text-3xl font-bold text-amber-400 mb-2">Instant Scratch</h2>
            <p className="text-slate-400 mb-8">Sub-second blockchain results. (UI Demo)</p>
            
            <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-1 rounded-2xl w-64 h-64 cursor-pointer transform hover:scale-105 transition-all">
              <div className="bg-slate-900 w-full h-full rounded-xl flex items-center justify-center border-4 border-dashed border-amber-500/50">
                <span className="text-amber-500 font-black text-2xl uppercase">Scratch Me</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}