const { useState, useEffect } = React;

function AutoFitApp() {
  const [activeTab, setActiveTab] = useState('home'); // home | routines | workout | progress | records
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_key') || '');
  const [showConfig, setShowConfig] = useState(!localStorage.getItem('openai_key'));
  
  // Estado de Rutinas
  const [routines, setRoutines] = useState(() => {
    return JSON.parse(localStorage.getItem('autofit_routines') || '[]');
  });

  // Estado de Entrenamientos Registrados
  const [history, setHistory] = useState(() => {
    return JSON.parse(localStorage.getItem('autofit_history') || '[]');
  });

  // Estado de Sesión Activa
  const [activeSession, setActiveSession] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Estado de Escaneo/OCR
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedResult, setScannedResult] = useState(null);

  useEffect(() => {
    localStorage.setItem('autofit_routines', JSON.stringify(routines));
  }, [routines]);

  useEffect(() => {
    localStorage.setItem('autofit_history', JSON.stringify(history));
  }, [history]);

  // Temporizador de Descanso
  useEffect(() => {
    let interval = null;
    if (timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(prev => prev - 1), 1000);
    } else if (timerSeconds === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const startTimer = (seconds) => {
    setTimerSeconds(seconds);
  };

  const calc1RM = (w, r) => (r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10);

  // Crear Rutina Base de Ejemplo
  const createDefaultRoutine = () => {
    const defaultRoutine = {
      id: Date.now(),
      title: "Fuerza 3 Días",
      days: [
        {
          id: "d1",
          title: "Día 1 - Pecho + Tríceps",
          blocks: [
            { id: "b1", type: "NORMAL", exercises: [{ name: "Press Banca", sets: "4", reps: "6-8", rest: 180 }] },
            { 
              id: "b2", 
              type: "SUPERSET", 
              label: "SUPERSET A", 
              exercises: [
                { name: "Press Inclinado", sets: "3", reps: "8-10" },
                { name: "Remo con Mancuerna", sets: "3", reps: "8-10" }
              ],
              rest: 90
            }
          ]
        }
      ]
    };
    setRoutines([...routines, defaultRoutine]);
  };

  // Iniciar Sesión desde la Rutina
  const startWorkoutFromDay = (day) => {
    const session = {
      id: Date.now(),
      title: day.title,
      startedAt: new Date().toISOString(),
      blocks: JSON.parse(JSON.stringify(day.blocks)).map(b => ({
        ...b,
        loggedSets: b.exercises.map(ex => ({
          exerciseName: ex.name,
          weight: 80,
          reps: 8,
          rir: 2,
          completed: false
        }))
      }))
    };
    setActiveSession(session);
    setActiveTab('workout');
  };

  // Registrar Serie
  const logSet = (blockIdx, exIdx) => {
    startTimer(90);
    const updated = { ...activeSession };
    updated.blocks[blockIdx].loggedSets[exIdx].completed = true;
    setActiveSession(updated);
  };

  // Finalizar Entrenamiento
  const finishWorkout = () => {
    let totalVol = 0;
    let totalSets = 0;

    activeSession.blocks.forEach(b => {
      b.loggedSets.forEach(s => {
        if (s.completed) {
          totalVol += (s.weight * s.reps);
          totalSets++;
        }
      });
    });

    const completedWorkout = {
      ...activeSession,
      completedAt: new Date().toLocaleDateString('es-ES'),
      totalVolume: totalVol,
      totalSets: totalSets
    };

    setHistory([completedWorkout, ...history]);
    setActiveSession(null);
    setActiveTab('home');
    alert("¡Entrenamiento guardado con éxito!");
  };

  // Handler para Selección de Foto u OCR
  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!apiKey) {
      alert("Añade tu API Key de OpenAI para usar OCR.");
      setShowConfig(true);
      return;
    }

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result.split(',')[1];
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Extrae los ejercicios en JSON con formato: {\"title\": \"Entreno Escaneado\", \"sets\": [{\"exercise\": \"Press Banca\", \"weight\": 80, \"reps\": 8, \"type\": \"NORMAL\"}]}"
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Procesa este entrenamiento." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        const data = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        setScannedResult(parsed);
      } catch (err) {
        alert("Error en el escaneo: " + err.message);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 text-slate-100 font-sans border-x border-slate-800">
      
      {/* HEADER */}
      <header className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <span className="font-extrabold text-lg tracking-wider text-white">AUTOFIT <span className="text-emerald-400">PRO</span></span>
        <div className="flex items-center gap-2">
          {timerSeconds > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold animate-pulse">
              ⏱️ {Math.floor(timerSeconds / 60)}:{('0' + (timerSeconds % 60)).slice(-2)}
            </div>
          )}
          <button onClick={() => setShowConfig(!showConfig)} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
            ⚙️
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* CONFIGURACIÓN API KEY */}
        {showConfig && (
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-emerald-400 uppercase">Configuración OpenAI</h3>
            <input 
              type="password" 
              placeholder="sk-..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
            />
            <button onClick={() => { localStorage.setItem('openai_key', apiKey); setShowConfig(false); }} className="w-full py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs">
              Guardar Key
            </button>
          </div>
        )}

        {/* TAB INICIO */}
        {activeTab === 'home' && (
          <>
            <label className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 rounded-2xl cursor-pointer shadow-lg active:scale-[0.98] transition">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              <span className="text-2xl">📸</span>
              <span className="text-sm font-black tracking-wide uppercase mt-1">Registrar con Foto</span>
              <span className="text-[10px] font-medium opacity-80">IA/OCR detecta tus ejercicios</span>
            </label>

            {isAnalyzing && <div className="p-4 bg-slate-900 rounded-2xl text-center text-emerald-400 text-xs animate-pulse">Analizando imagen con IA...</div>}
            
            {scannedResult && (
              <div className="bg-slate-900 p-4 rounded-2xl border border-emerald-500/40 space-y-2">
                <h3 className="text-xs font-bold text-emerald-400">Detectado: {scannedResult.title}</h3>
                <div className="text-xs space-y-1">
                  {scannedResult.sets.map((s, i) => (
                    <div key={i} className="flex justify-between bg-slate-950 p-2 rounded border border-slate-800">
                      <span>{s.exercise}</span>
                      <span className="font-bold">{s.weight} kg × {s.reps}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setScannedResult(null)} className="w-full py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs">
                  Confirmar y Guardar
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Volumen Total</span>
                <div className="text-lg font-black text-white mt-1">
                  {history.reduce((a, b) => a + (b.totalVolume || 0), 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Entrenamientos</span>
                <div className="text-lg font-black text-white mt-1">{history.length}</div>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Últimas Sesiones</span>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No hay entrenamientos guardados.</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs flex justify-between">
                    <div>
                      <div className="font-bold text-slate-200">{h.title}</div>
                      <div className="text-slate-500">{h.totalSets} series · {h.totalVolume} kg</div>
                    </div>
                    <span className="text-slate-400">{h.completedAt}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* TAB RUTINAS */}
        {activeTab === 'routines' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-300">Mis Rutinas</h2>
              <button onClick={createDefaultRoutine} className="text-xs bg-emerald-500 text-slate-950 px-3 py-1.5 font-bold rounded-xl">
                + Nueva Rutina
              </button>
            </div>

            {routines.map(r => (
              <div key={r.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="font-bold text-emerald-400">{r.title}</h3>
                {r.days.map(d => (
                  <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold">{d.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{d.blocks.length} Bloques de trabajo</div>
                    </div>
                    <button onClick={() => startWorkoutFromDay(d)} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-bold">
                      Entrenar
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* TAB ENTRENAR */}
        {activeTab === 'workout' && (
          <div className="space-y-4">
            {!activeSession ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-xs text-slate-400">No hay ninguna sesión activa.</p>
                <button onClick={() => setActiveTab('routines')} className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs">
                  Seleccionar una Rutina
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">En progreso</span>
                    <h2 className="text-base font-bold">{activeSession.title}</h2>
                  </div>
                  <button onClick={finishWorkout} className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs">
                    Finalizar
                  </button>
                </div>

                {activeSession.blocks.map((block, bIdx) => (
                  <div key={block.id} className={`p-4 rounded-2xl border space-y-3 ${block.type === 'SUPERSET' ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${block.type === 'SUPERSET' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                        {block.label || block.type}
                      </span>
                      <span className="text-[10px] text-slate-500">Descanso: {block.rest || 90}s</span>
                    </div>

                    {block.loggedSets.map((s, eIdx) => (
                      <div key={eIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{s.exerciseName}</span>
                          <span className="text-emerald-400">1RM: {calc1RM(s.weight, s.reps)} kg</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="text-[9px] text-slate-500 block">PESO (KG)</label>
                            <input 
                              type="number" 
                              value={s.weight} 
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = { ...activeSession };
                                updated.blocks[bIdx].loggedSets[eIdx].weight = val;
                                setActiveSession(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-center font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 block">REPS</label>
                            <input 
                              type="number" 
                              value={s.reps} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const updated = { ...activeSession };
                                updated.blocks[bIdx].loggedSets[eIdx].reps = val;
                                setActiveSession(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-center font-bold"
                            />
                          </div>
                          <div className="flex items-end">
                            <button 
                              onClick={() => logSet(bIdx, eIdx)}
                              className={`w-full py-1 rounded font-bold text-xs ${s.completed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                              {s.completed ? '✓ Listo' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB PROGRESO */}
        {activeTab === 'progress' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300">Análisis de Progreso</h2>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400">Evolución de 1RM (Press Banca)</span>
              <div className="h-32 flex items-end justify-between gap-2 pt-4 px-2 border-b border-slate-800">
                <div className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-t h-[60%] relative group"><span className="absolute -top-4 text-[9px] w-full text-center">90kg</span></div>
                <div className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-t h-[75%] relative group"><span className="absolute -top-4 text-[9px] w-full text-center">95kg</span></div>
                <div className="w-full bg-emerald-500 hover:bg-emerald-400 rounded-t h-[90%] relative group"><span className="absolute -top-4 text-[9px] w-full text-center text-emerald-400 font-bold">102kg</span></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                <span>Hace 1 mes</span>
                <span>Hace 2 sem</span>
                <span>Actual</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB RÉCORDS */}
        {activeTab === 'records' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300">Récords Personales (PRs)</h2>
            <div className="space-y-2">
              <div className="bg-slate-900 p-3 rounded-2xl border border-amber-500/30 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">Press Banca</div>
                  <div className="text-[10px] text-slate-400">Máximo Peso Calculado</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-amber-400">85 kg × 6</div>
                  <div className="text-[9px] text-slate-500">1RM est: 102 kg</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* NAVBAR INFERIOR */}
      <nav className="bg-slate-900 border-t border-slate-800 px-2 py-2 flex justify-around text-[10px] text-slate-400">
        <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-emerald-400 font-bold' : ''}>🏠 Inicio</button>
        <button onClick={() => setActiveTab('routines')} className={activeTab === 'routines' ? 'text-emerald-400 font-bold' : ''}>📋 Rutinas</button>
        <button onClick={() => setActiveTab('workout')} className={activeTab === 'workout' ? 'text-emerald-400 font-bold' : ''}>🏋️ Entrenar</button>
        <button onClick={() => setActiveTab('progress')} className={activeTab === 'progress' ? 'text-emerald-400 font-bold' : ''}>📊 Progreso</button>
        <button onClick={() => setActiveTab('records')} className={activeTab === 'records' ? 'text-emerald-400 font-bold' : ''}>🏆 Récords</button>
      </nav>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AutoFitApp />);
