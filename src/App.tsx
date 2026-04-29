import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, ChefHat, Frown, ArrowRight, Loader2, MessageSquare, Send, Heart, X, BookOpen, Trash2, Clock, ImagePlus } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai/web";
import { motion, AnimatePresence } from 'motion/react';

// Initialize AI
const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing! Make sure it's set in Vercel environment variables.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

type Recipe = {
  name: string;
  description: string;
  imagePrompt: string;
  timeInMinutes: number;
};

type FullRecipe = Recipe & {
  image: string | null;
  steps: RecipeStep[];
};

type RecipeStep = {
  stepNumber: number;
  instruction: string;
};

type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

type AppState = 'START' | 'ANALYSING' | 'SUGGESTIONS' | 'PREPARING_RECIPE' | 'RECIPE_DETAIL' | 'SAVED_RECIPES';

const DynamicBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-[#FFF5F0] via-[#FFFFFF] to-[#FFF0E6]">
    {/* Flowing Organic Gradients */}
    <motion.div 
      animate={{ 
        x: ['-10%', '10%', '-10%'],
        y: ['-10%', '5%', '-10%'],
        rotate: [0, 45, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] opacity-60"
      style={{ background: 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, rgba(255,165,0,0) 70%)' }}
    />
    <motion.div 
      animate={{ 
        x: ['10%', '-10%', '10%'],
        y: ['5%', '-10%', '5%'],
        rotate: [0, -45, 0],
        scale: [1, 1.2, 1]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] opacity-70"
      style={{ background: 'radial-gradient(circle, rgba(255,95,46,0.2) 0%, rgba(255,95,46,0) 60%)' }}
    />
    <motion.div 
      animate={{ 
        x: ['-5%', '15%', '-5%'],
        y: ['15%', '-5%', '15%'],
        rotate: [0, 90, 0],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-[20%] left-[40%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] opacity-50"
      style={{ background: 'radial-gradient(circle, rgba(255,214,100,0.3) 0%, rgba(255,214,100,0) 60%)' }}
    />
    <motion.div 
      animate={{ 
        x: ['15%', '-5%', '15%'],
        y: ['-5%', '15%', '-5%'],
      }}
      transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute bottom-[20%] left-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] opacity-40"
      style={{ background: 'radial-gradient(circle, rgba(255,75,75,0.15) 0%, rgba(255,75,75,0) 70%)' }}
    />
    
    {/* Geometric Grid Pattern Overlay */}
    <div className="absolute inset-0 opacity-[0.4]" 
      style={{ backgroundImage: 'linear-gradient(rgba(255, 95, 46, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 95, 46, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
    />
    
    {/* Refined Noise filter */}
    <div 
      className="absolute inset-0 opacity-[0.2] mix-blend-overlay" 
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
    />
  </div>
);

export default function App() {
  const [appState, setAppState] = useState<AppState>('START');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [fridgeImage, setFridgeImage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);

  // Saved Recipes
  const [savedRecipes, setSavedRecipes] = useState<FullRecipe[]>([]);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hate_cooking_saved');
    if (saved) {
      setSavedRecipes(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const togglePreference = (pref: string) => {
    setPreferences(prev => prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]);
  };

  const handleSaveRecipe = () => {
    if (!selectedRecipe || !recipeImage || recipeSteps.length === 0) return;
    const isAlreadySaved = savedRecipes.some(r => r.name === selectedRecipe.name);
    if (isAlreadySaved) return;

    const fullRecipe: FullRecipe = { ...selectedRecipe, image: recipeImage, steps: recipeSteps };
    const newSaved = [...savedRecipes, fullRecipe];
    setSavedRecipes(newSaved);
    localStorage.setItem('hate_cooking_saved', JSON.stringify(newSaved));
  };
  
  const deleteSavedRecipe = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSaved = savedRecipes.filter(r => r.name !== name);
    setSavedRecipes(newSaved);
    localStorage.setItem('hate_cooking_saved', JSON.stringify(newSaved));
  };

  const loadSavedRecipe = (recipe: FullRecipe) => {
    setSelectedRecipe({ name: recipe.name, description: recipe.description, imagePrompt: recipe.imagePrompt, timeInMinutes: recipe.timeInMinutes });
    setRecipeImage(recipe.image);
    setRecipeSteps(recipe.steps);
    setAppState('RECIPE_DETAIL');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');
    const newMsgs: ChatMessage[] = [...chatMessages, { role: 'user', text }];
    setChatMessages(newMsgs);
    setIsChatting(true);

    try {
      const contents = newMsgs.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      
      let contextStr = "You are an aggressive, brutally honest, but secretly helpful chef answering cooking questions for someone who hates cooking. Use short, punchy sentences.";
      if (selectedRecipe && recipeSteps.length > 0) {
        contextStr += ` Right now, they are making "${selectedRecipe.name}". Instructions they have: ${recipeSteps.map(s => s.instruction).join(' ')}.`;
      }

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: { systemInstruction: contextStr },
        contents: contents,
      });

      setChatMessages(prev => [...prev, { role: 'model', text: res.text || 'I have no words.' }]);
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'model', text: 'The stove caught fire. (API Error)' }]);
    }
    setIsChatting(false);
  };
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullDataUrl = reader.result as string;
        setFridgeImage(fullDataUrl);
        const base64Data = fullDataUrl.split(',')[1];
        const mimeType = file.type;
        analyzeFridge(base64Data, mimeType);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFridge = async (base64Data: string, mimeType: string) => {
    setAppState('ANALYSING');
    setErrorMsg(null);
    try {
      let promptText = "Analyze the ingredients in this fridge. Suggest 3 extremely simple, low-effort recipes using mainly these ingredients. The user HATES cooking, so make them foolproof and quick. Start each recipe name with a relevant food emoji.";
      if (preferences.length > 0) {
        promptText += ` IMPORTANT: The recipes MUST adhere entirely to these dietary requirements or preferences: ${preferences.join(', ')}.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: promptText }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of ingredients found" },
               recipes: {
                  type: Type.ARRAY, items: {
                    type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
                          imagePrompt: { type: Type.STRING, description: "A detailed visual prompt for an AI image generator to accurately depict the final cooked dish on a plate" },
                          timeInMinutes: { type: Type.NUMBER, description: "Total estimated time (prep + cook) in minutes" }
                        },
                        required: ["name", "description", "imagePrompt", "timeInMinutes"]
                  }
               }
            },
            required: ["ingredients", "recipes"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      if (data.ingredients && data.recipes) {
        setIngredients(data.ingredients);
        
        // Parallel image generation for suggestions
        const recipesWithImages = await Promise.all(data.recipes.map(async (r: any) => {
          try {
            const imgRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: r.imagePrompt + " Food photography, centered, white background, high quality." }] },
              config: { imageConfig: { aspectRatio: "1:1" } }
            });
            const imgData = imgRes.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
            return { ...r, image: imgData ? `data:image/png;base64,${imgData}` : null };
          } catch (e) {
            console.error("Image gen failed for suggestion", e);
            return { ...r, image: null };
          }
        }));

        setRecipes(recipesWithImages);
        setAppState('SUGGESTIONS');
      } else {
        throw new Error("Failed to parse recipes.");
      }
    } catch (err: any) {
      console.error("Analysis Error:", err);
      const msg = err.message || "Unknown error";
      setErrorMsg(`Something went wrong: ${msg}. Check if your API key is valid.`);
      setAppState('START');
    }
  };

  const selectRecipe = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setAppState('PREPARING_RECIPE');
    setErrorMsg(null);
    setRecipeImage(null);
    setRecipeSteps([]);

    try {
      // 1. Fetch text steps
      const stepsPromise = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Give me foolproof, extremely simple step-by-step instructions to cook "${recipe.name}" using mostly: ${ingredients.join(', ')}. The user HATES cooking, so write the steps in a direct, slightly sarcastic but helpful tone. Keep them very short.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
               type: Type.OBJECT,
               properties: {
                  stepNumber: { type: Type.NUMBER },
                  instruction: { type: Type.STRING }
               },
               required: ["stepNumber", "instruction"]
            }
          }
        }
      });

      // 2. Output image
      const imagePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: recipe.imagePrompt + " Professional food photography, delicious looking, well lit." }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9" }
        },
      });

      const [stepsRes, imageRes] = await Promise.allSettled([stepsPromise, imagePromise]);
      
      if (stepsRes.status === 'fulfilled') {
        const steps = JSON.parse(stepsRes.value.text || '[]');
        setRecipeSteps(steps);
      } else {
        throw new Error("Failed to get instructions.");
      }

      if (imageRes.status === 'fulfilled') {
        for (const part of imageRes.value.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setRecipeImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }

      setAppState('RECIPE_DETAIL');
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to prepare the recipe details.");
      setAppState('SUGGESTIONS');
    }
  };

  const reset = () => {
    setAppState('START');
    setFridgeImage(null);
    setIngredients([]);
    setRecipes([]);
    setSelectedRecipe(null);
    setRecipeImage(null);
    setRecipeSteps([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden font-sans relative">
      <DynamicBackground />
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 px-4 md:px-10 py-6 relative z-10">
        
        {/* Header Navigation */}
        <nav className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <motion.div 
              animate={{ y: [0, -5, 0] }} 
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-10 h-10 bg-[#FF5F2E] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30"
            >
              <ChefHat className="text-white" size={24} />
            </motion.div>
            <span className="text-3xl font-black tracking-tighter text-[#FF5F2E]">HATE COOKING.</span>
          </div>
          <div className="flex gap-4 items-center">
            {appState !== 'SAVED_RECIPES' && (
              <button 
                onClick={() => setAppState('SAVED_RECIPES')} 
                className="touch-manipulation select-none px-6 py-2 bg-white border-2 border-[#FF5F2E] text-[#FF5F2E] font-bold rounded-full hover:bg-orange-50 transition-all duration-75 active:scale-95 hover:-translate-y-0.5 flex items-center gap-2 hover:shadow-md"
              >
                 <BookOpen size={18} /> My Recipes
              </button>
            )}
            {appState !== 'START' && (
              <button 
                onClick={reset} 
                className="touch-manipulation select-none px-6 py-2 bg-[#FF5F2E] text-white font-black rounded-full shadow-lg shadow-orange-200 uppercase tracking-wide hover:bg-orange-600 transition-all duration-75 active:scale-95 hover:-translate-y-0.5 flex items-center gap-2 hover:shadow-xl hover:shadow-orange-300"
              >
                 <RefreshCw size={18} /> New Scan
              </button>
            )}
          </div>
        </nav>

        {errorMsg && (
          <div className="mx-auto max-w-md w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-8 font-bold flex items-center gap-3 shadow-sm">
            <Frown size={24} />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col pb-10">
          <AnimatePresence mode="wait">
            
            {appState === 'START' && (
              <motion.div 
                key="start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center flex-1 text-center mt-12 md:mt-24 px-4"
              >
                <div className="mb-10 w-full max-w-2xl relative">
                  <div className="absolute -inset-4 bg-orange-100/50 rounded-[3rem] -z-10 blur-2xl"></div>
                  <img src="/images/hero.png" alt="Delicious Food" className="w-full h-64 md:h-80 object-cover rounded-[2.5rem] shadow-2xl border-4 border-white mb-8" />
                  <div className="text-center">
                    <h1 className="text-5xl md:text-7xl font-black leading-none text-[#FF5F2E] mb-6 tracking-tighter">TOO LAZY TO THINK? 🥱</h1>
                    <p className="text-xl text-gray-500 mb-8 max-w-lg mx-auto font-medium">Snap a picture of your fridge. We'll tell you what to make with zero effort. 🍕</p>
                  </div>
                </div>

                <div className="mb-10 w-full max-w-lg">
                  <h3 className="font-bold text-gray-400 mb-3 uppercase tracking-widest text-sm">Any demands?</h3>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {[
                      { name: 'Vegetarian', emoji: '🥗' },
                      { name: 'Vegan', emoji: '🌱' },
                      { name: 'Gluten Free', emoji: '🌾' },
                      { name: 'High Protein', emoji: '💪' },
                      { name: 'No Cook', emoji: '🧊' }
                    ].map(pref => (
                      <button 
                        key={pref.name} 
                        onClick={() => togglePreference(pref.name)}
                        className={`touch-manipulation select-none px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-75 active:scale-95 ${preferences.includes(pref.name) ? 'bg-[#FF5F2E] text-white border-[#FF5F2E] shadow-md shadow-orange-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:shadow-sm hover:-translate-y-0.5'}`}
                      >
                        {pref.emoji} {pref.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md mx-auto">
                  <button 
                    onClick={() => cameraInputRef.current?.click()}
                    className="touch-manipulation select-none px-8 py-4 bg-[#FF5F2E] text-white font-black text-xl rounded-full shadow-lg shadow-orange-200 uppercase tracking-wide flex items-center justify-center gap-3 transition-transform duration-75 active:scale-95 hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <Camera size={28} />
                    SNAP FRIDGE
                  </button>
                  <button 
                    onClick={() => uploadInputRef.current?.click()}
                    className="touch-manipulation select-none px-8 py-4 bg-white border-2 border-orange-100 text-[#FF5F2E] font-black text-xl rounded-full shadow-lg uppercase tracking-wide flex items-center justify-center gap-3 transition-transform duration-75 active:scale-95 hover:-translate-y-1 hover:bg-orange-50"
                  >
                    <ImagePlus size={28} />
                    UPLOAD PHOTO
                  </button>
                </div>
                
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={cameraInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={uploadInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
              </motion.div>
            )}

            {appState === 'ANALYSING' && (
              <motion.div 
                key="analysing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="flex flex-col items-center justify-center flex-1 mt-12 md:mt-24"
              >
                <div className="relative w-64 h-64 bg-white rounded-[3rem] p-2 shadow-xl mb-8 border-4 border-white overflow-hidden">
                  {fridgeImage ? (
                    <img src={fridgeImage} alt="fridge preview" className="w-full h-full object-cover rounded-[2.5rem] filter brightness-75" />
                  ) : (
                    <div className="w-full h-full bg-orange-50 rounded-[2.5rem]" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-full shadow-lg">
                      <Loader2 className="animate-spin text-[#FF5F2E]" size={48} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-2xl font-black tracking-tight text-[#2D2D2D]">
                  <span>JUDGING YOUR FRIDGE...</span>
                </div>
              </motion.div>
            )}

            {appState === 'SUGGESTIONS' && (
              <motion.div 
                key="suggestions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full"
              >
                {/* Left Sidebar: Fridge Scan Results */}
                <section className="md:col-span-4 flex flex-col gap-6">
                  <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-orange-100 flex flex-col">
                    <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
                      <span className="w-2 h-8 bg-orange-400 rounded-full"></span>
                      Detected Items
                    </h2>
                    <div className="space-y-3">
                      {ingredients.map((ing, i) => {
                         const colors = ['green', 'yellow', 'orange', 'blue', 'red'];
                         const color = colors[i % colors.length];
                         return (
                          <div key={i} className={`flex items-center justify-between p-3 bg-${color}-50 rounded-2xl border border-${color}-100`}>
                            <span className={`font-bold text-${color}-700 capitalize`}>{ing}</span>
                          </div>
                         )
                      })}
                    </div>
                  </div>
                </section>

                {/* Center: Recipes */}
                <section className="md:col-span-8 flex flex-col gap-6">
                  <h2 className="text-3xl font-black tracking-tight text-[#2D2D2D] md:mt-2">PICK YOUR POISON:</h2>
                  <div className="flex flex-col gap-4">
                    {recipes.map((r, idx) => (
                      <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => selectRecipe(r)}
                        className="bg-white rounded-[2rem] p-4 shadow-sm border border-orange-100 flex items-center gap-6 group cursor-pointer hover:shadow-md hover:border-orange-200 transition-all"
                      >
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-orange-50 rounded-2xl overflow-hidden shrink-0">
                          {(r as any).image ? (
                            <img src={(r as any).image} alt={r.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">🍲</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-extrabold text-[#2D2D2D] group-hover:text-[#FF5F2E] transition-colors">
                              {r.name}
                            </h3>
                            <div className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                              <Clock size={12} />
                              {r.timeInMinutes}m
                            </div>
                          </div>
                          <p className="text-gray-500 font-medium leading-relaxed line-clamp-2">{r.description}</p>
                        </div>
                        <ArrowRight className="shrink-0 ml-auto text-gray-300 group-hover:text-[#FF5F2E] group-hover:translate-x-2 transition-all w-6 h-6" />
                      </motion.div>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}

            {appState === 'PREPARING_RECIPE' && (
               <motion.div 
                key="preparing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center flex-1 mt-12 md:mt-24 text-center"
              >
                <div className="w-24 h-24 bg-[#FF5F2E] rounded-full flex items-center justify-center text-white mb-6 animate-bounce shadow-xl shadow-orange-200">
                  <ChefHat size={48} />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-4 text-[#2D2D2D]">Dumbing it down for you...</h2>
                <p className="text-gray-500 font-medium text-lg">Generating the absolute easiest steps possible.</p>
              </motion.div>
            )}

            {appState === 'RECIPE_DETAIL' && selectedRecipe && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full"
              >
                {/* Center: Recipe Detail */}
                <section className="md:col-span-7 flex flex-col gap-6">
                  <div className="flex items-center justify-between mb-2">
                    <button 
                      onClick={() => setAppState('SUGGESTIONS')}
                      className="font-bold text-sm uppercase flex items-center gap-2 text-gray-400 hover:text-[#FF5F2E] transition-colors w-fit"
                    >
                      <ArrowRight className="rotate-180" size={16}/> BACK TO OPTIONS
                    </button>
                    {!savedRecipes.some(r => r.name === selectedRecipe.name) ? (
                      <button 
                        onClick={handleSaveRecipe}
                        className="font-bold text-sm uppercase flex items-center gap-2 text-[#FF5F2E] bg-orange-100 hover:bg-orange-200 px-4 py-2 rounded-full transition-colors"
                      >
                        <Heart size={16} /> SAVE RECIPE
                      </button>
                    ) : (
                      <div className="font-bold text-sm uppercase flex items-center gap-2 text-green-600 bg-green-100 px-4 py-2 rounded-full">
                        <Heart size={16} fill="currentColor" /> SAVED
                      </div>
                    )}
                  </div>

                  <div className="relative flex-1 bg-white rounded-[3rem] shadow-xl overflow-hidden border-4 border-white flex flex-col">
                    {/* Recipe Image Placeholder */}
                    <div className="h-64 md:h-80 bg-gradient-to-br from-[#FFC898] to-[#FF8C64] relative overflow-hidden">
                      {recipeImage && (
                        <motion.img 
                          initial={{ scale: 1.2, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          src={recipeImage} 
                          alt={selectedRecipe.name} 
                          className="w-full h-full object-cover absolute inset-0" 
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <div className="absolute bottom-6 left-8 right-8 text-white z-10 text-left">
                        <div className="flex gap-2 mb-3">
                          <div className="px-3 py-1 bg-black/30 backdrop-blur-md rounded-lg text-sm font-bold w-fit uppercase tracking-widest">Low Effort</div>
                          <div className="px-3 py-1 bg-black/30 backdrop-blur-md rounded-lg text-sm font-bold w-fit uppercase tracking-widest flex items-center gap-1">
                            <Clock size={14} /> {selectedRecipe.timeInMinutes} MINS
                          </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black leading-none">{selectedRecipe.name}</h1>
                      </div>
                    </div>
                    
                    <div className="p-8">
                      <p className="text-gray-500 leading-relaxed font-medium">
                        {selectedRecipe.description}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Right: Step by Step Navigation */}
                <section className="md:col-span-5 flex flex-col gap-6">
                  <div className="bg-[#332211] rounded-[2.5rem] p-6 md:p-8 text-white flex-1 flex flex-col md:mt-12">
                    <h2 className="text-sm font-black uppercase tracking-widest mb-6 opacity-60 italic">INSTRUCTIONS</h2>
                    <div className="flex-1 flex flex-col space-y-8">
                      {recipeSteps.map((step, index) => (
                        <motion.div 
                          key={step.stepNumber} 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex flex-col gap-3"
                        >
                          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-lg font-black shadow-lg shadow-orange-900/40">
                            {step.stepNumber}
                          </div>
                          <p className="text-lg font-bold text-white leading-snug px-1">
                            {step.instruction}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {appState === 'SAVED_RECIPES' && (
              <motion.div 
                key="saved"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-4xl mx-auto"
              >
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setAppState('START')} className="p-3 bg-white rounded-full shadow-sm hover:text-[#FF5F2E]">
                    <ArrowRight className="rotate-180" size={20} />
                  </button>
                  <h2 className="text-4xl font-black text-[#2D2D2D]">MY RECIPES</h2>
                </div>

                {savedRecipes.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-200">
                    <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-400 mb-2">You haven't saved anything.</h3>
                    <p className="text-gray-500">Go scan your fridge and find a recipe first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {savedRecipes.map(recipe => (
                      <motion.div 
                        key={recipe.name} 
                        whileHover={{ y: -5 }}
                        onClick={() => loadSavedRecipe(recipe)} 
                        className="bg-white rounded-[2rem] p-4 shadow-sm border border-orange-100 cursor-pointer hover:shadow-lg transition-all flex flex-col h-full group"
                      >
                        <div className="h-48 rounded-[1.5rem] bg-gray-200 mb-4 overflow-hidden relative">
                          {recipe.image && <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                           <button onClick={(e) => deleteSavedRecipe(recipe.name, e)} className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-red-100 hover:text-red-600 rounded-full text-gray-600 backdrop-blur-md transition-colors">
                              <Trash2 size={18} />
                           </button>
                        </div>
                        <h3 className="text-xl font-extrabold mb-2 text-[#2D2D2D] line-clamp-1">{recipe.name}</h3>
                        <p className="text-gray-500 font-medium text-sm line-clamp-2 mb-4">{recipe.description}</p>
                        <div className="mt-auto flex justify-between items-center text-sm font-bold text-[#FF5F2E]">
                          <span>{recipe.steps.length} Steps</span>
                          <div className="flex items-center gap-1 text-gray-400 font-bold group-hover:text-[#FF5F2E] transition-colors">
                            <Clock size={14} />
                            {recipe.timeInMinutes}m
                            <ArrowRight className="ml-1" size={16} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* Chef Chatbot */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white border-2 border-orange-200 rounded-[2rem] shadow-2xl w-80 md:w-96 h-[500px] max-h-[80vh] flex flex-col overflow-hidden mb-4"
            >
              <div className="bg-[#FF5F2E] p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <ChefHat size={20} />
                  <span className="font-bold">Angry Chef Bot</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-orange-50/50">
                 {chatMessages.length === 0 && (
                   <div className="text-center text-gray-400 text-sm italic mt-10">
                     Ask a cooking question. Make it quick.
                   </div>
                 )}
                 {chatMessages.map((msg, i) => (
                   <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] rounded-2xl p-3 text-sm font-medium ${msg.role === 'user' ? 'bg-[#FF5F2E] text-white rounded-tr-sm' : 'bg-white border border-orange-100 text-gray-700 rounded-tl-sm shadow-sm'}`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}
                 {isChatting && (
                   <div className="flex justify-start">
                     <div className="bg-white border border-orange-100 text-gray-700 rounded-2xl rounded-tl-sm shadow-sm p-3 flex gap-1">
                       <span className="animate-bounce inline-block w-2 h-2 bg-orange-400 rounded-full"></span>
                       <span className="animate-bounce block w-2 h-2 bg-orange-400 rounded-full" style={{animationDelay: '0.2s'}}></span>
                       <span className="animate-bounce block w-2 h-2 bg-orange-400 rounded-full" style={{animationDelay: '0.4s'}}></span>
                     </div>
                   </div>
                 )}
                 <div ref={chatEndRef} />
              </div>
              <div className="p-3 bg-white border-t border-orange-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Need a substitute?"
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isChatting}
                  className="w-10 h-10 bg-[#FF5F2E] text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-orange-600 transition-colors"
                >
                  <Send size={16} className="-ml-0.5 mt-0.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`touch-manipulation select-none w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-75 active:scale-95 hover:scale-105 hover:shadow-2xl ${isChatOpen ? 'bg-gray-800' : 'bg-[#FF5F2E]'}`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>
    </div>
  );
}

