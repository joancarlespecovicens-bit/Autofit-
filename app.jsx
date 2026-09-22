const { useState, useEffect } = React;

function AutoFitApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_key') || '');
  const [showConfig, setShowConfig] = useState(!localStorage.getItem('openai_key'));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [quickText, setQuickText] = useState('');

  // Historial local guardado en el móvil
  const [workouts, setWorkouts] = useState(() => {
    return JSON.parse(localStorage.getItem('autofit_workouts') || '[]');
  });

  const [currentDraft, setCurrentDraft] = useState({
    name: 'Entrenamiento de Pecho',
    sets: []
  });

  useEffect(() => {
    localStorage.setItem('autofit_workouts', JSON.stringify(workouts));
  }, [workouts]);

  // Guardar API Key
  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openai_key', key);
    setShowConfig(false);
  };

  // Cálculo de 1RM (Epley)
  const calc1RM = (w, r) => (r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10);

  // Parser para texto rápido: "press banca 80x8, 80x8, 85x6"
  const handleQuickParse = () => {
    if (!quickText.trim()) return;
    const regex = /(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+)/g;
    const matches = [...quickText.matchAll(regex)];

    if (matches.length === 0) return;

    const firstMatchIdx = matches[0].index;
    let exerciseName = quickText.substring(0, firstMatchIdx).trim().replace(/[:\-]$/, '') || 'Ejercicio';

    const newSets = matches.map(m => ({
      exercise: exerciseName,
      weight: parseFloat(m[1]),
      reps: parseInt(m[2], 10)
    }));

    setCurrentDraft({
      name: exerciseName,
      sets: newSets
    });
    setReviewMode(true);
    setQuickText('');
  };

  // Procesamiento de foto mediante GPT-4o
  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!apiKey) {
      alert("Por favor, introduce tu API Key de OpenAI en la configuración.");
      setShowConfig(true);
      return;
    }

    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result.split(',')[1];

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: `Eres un parser de entrenamientos. Analiza la imagen y extrae ejercicios, peso en kg y repeticiones. Devuelve SOLO un JSON con esta estructura exactas: {"sets": [{"exercise": "Press Banca", "weight": 80, "reps": 8}]}`
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extrae los ejercicios de esta imagen." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);

        if (parsed.sets && parsed.sets.length > 0) {
          setCurrentDraft({
            name: parsed.sets[0]?.exercise ? `Sesión ${parsed.sets[0].exercise}` : 'Entrenamiento Escaneado',
            sets: parsed.sets
          });
          setReviewMode(true);
        } else {
          alert("No se detectaron series claras en la imagen.");
        }
      } catch (err) {
        alert("Error al analizar la imagen: " + err.message);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Guardar entrenamiento
  const saveWorkout = () => {
    const totalVol = currentDraft.sets.reduce((acc, s) => acc + (s.weight * s.reps), 0);
    const newWorkout = {
      id: Date.now(),
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      name: currentDraft.name,
      sets: currentDraft.sets,
      volume: totalVol
    };

    setWorkouts([newWorkout, ...workouts]);
    setReviewMode(false);
    setShowPRModal(true);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 text-slate-100 font-sans border-x border-slate-800">
      
      {/* HEADER */}
      <header className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg tracking-wider text-white">AUTOFIT <span className="text-emerald-400">AI</span></span>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
          ⚙️ Key
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* MODAL CONFIGURACIÓN API KEY */}
        {showConfig && (
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-emerald-400">Configurar OpenAI API Key</h3>
            <p className="text-xs text-slate-400">Necesaria únicamente para procesar las fotos con visión IA (se guarda localmente en tu teléfono).</p>
            <input 
              type="password" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button 
              onClick={() => saveApiKey(apiKey)} 
              className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs">
              Guardar Key
            </button>
          </div>
        )}

        {/* PANTALLA ANALIZANDO */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-64 space-y-4 bg-slate-900/80 rounded-2xl border border-emerald-500/30 p-6 text-center animate-pulse">
            <div className="text-4xl animate-bounce">📸</div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-400">Analizando foto...</h3>
              <p className="text-xs text-slate-400 mt-1">IA leyendo ejercicios, pesos y repeticiones</p>
            </div>
          </div>
        )}

        {/* MODAL REVISIÓN DE DATOS */}
        {reviewMode && !isAnalyzing && (
          <div className="space-y-4 bg-slate-900 p-4 rounded-2xl border border-emerald-500/40">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Revisión</span>
                <h2 className="text-lg font-bold">{currentDraft.name}</h2>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                {currentDraft.sets.length} Series
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {currentDraft.sets.map((set, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm">
                  <div>
                    <span className="font-medium text-slate-200">{set.exercise}</span>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {set.weight} kg × {set.reps} reps · <span className="text-emerald-400">1RM est: {calc1RM(set.weight, set.reps)}kg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-2 pt-2">
              <button onClick={() => setReviewMode(false)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-medium text-sm">
                Cancelar
              </button>
              <button onClick={saveWorkout} className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm">
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD PRINCIPAL */}
        {!reviewMode && !isAnalyzing && activeTab === 'home' && (
          <>
            {/* BOTÓN CÁMARA */}
            <label className="relative flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 rounded-2xl cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              <span className="text-3xl mb-1">📸</span>
              <span className="text-lg font-black tracking-wide uppercase">REGISTRAR CON FOTO</span>
              <span className="text-xs font-medium opacity-80 mt-0.5">Apunta a tu hoja manuscrita o nota</span>
            </label>

            {/* REGISTRO TEXTO RÁPIDO */}
            <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Registro Manual Rápido</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="ej: press banca 80x8, 85x6"
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button onClick={handleQuickParse} className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 border border-slate-700">
                  Añadir
                </button>
              </div>
            </div>

            {/* VOLUMEN Y ENTRENAMIENTOS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Vol. Registrado</span>
                <div className="text-xl font-black text-white mt-1">
                  {workouts.reduce((acc, w) => acc + w.volume, 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
                </div>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Sesiones</span>
                <div className="text-xl font-black text-white mt-1">{workouts.length}</div>
              </div>
            </div>

            {/* HISTORIAL RECIENTE */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial Reciente</span>
              {workouts.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No hay entrenamientos guardados. Haz una foto para empezar.</p>
              ) : (
                <div className="space-y-2">
                  {workouts.map((w) => (
                    <div key={w.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-200">{w.name}</div>
                        <div className="text-slate-500 mt-0.5">{w.sets.length} series · {w.volume} kg total</div>
                      </div>
                      <span className="text-slate-400">{w.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* MODAL DE RÉCORD */}
      {showPRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/50 p-6 rounded-3xl max-w-xs w-full text-center space-y-4 shadow-2xl">
            <div className="text-4xl">🏆</div>
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">¡Entrenamiento Guardado!</span>
              <p className="text-xs text-slate-400 mt-2">Los récords y estadísticas se han actualizado correctamente.</p>
            </div>
            <button onClick={() => setShowPRModal(false)} className="w-full py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs">
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-slate-900 border-t border-slate-800 px-2 py-3 flex justify-around text-xs text-slate-400">
        <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-emerald-400 font-bold' : ''}>🏠 Inicio</button>
        <button onClick={() => setActiveTab('workout')} className={activeTab === 'workout' ? 'text-emerald-400 font-bold' : ''}>🏋️ Entreno</button>
        <button onClick={() => setActiveTab('records')} className={activeTab === 'records' ? 'text-emerald-400 font-bold' : ''}>🏆 Récords</button>
      </nav>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AutoFitApp />);
