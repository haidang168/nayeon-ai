import { useState, useCallback, useRef, useEffect } from 'react';
import { Type } from "@google/genai";
import { ai } from '../lib/gemini';
import { groq, groqSafe } from '../lib/groq';
import { Message, Scenario } from '../types';
import { EvaluationData } from '../components/EvaluationModal';
import { useStats } from './useStats';
import { getRandomTopic, getRandomScenario, getRandomDebateAngle } from '../data/delfTopics';

// ─── Constants ───
const RE_END_PUNCT = /[.!?…]\s*$/;
const RE_MID_PUNCT = /[,;:–]\s*$/;

// ─── Prompt Engineering 2.0 ───

// 65+ real-life daily scenarios inspired by Inspire, Alter Ego & Édito textbooks
const FREE_TOPIC_POOL = [
  // 🛒 Courses & Alimentation
  "Au supermarché — faire les courses pour la semaine",
  "À la boulangerie — acheter du pain et des viennoiseries",
  "Au marché — choisir des fruits et légumes frais",
  "Préparer un dîner — organiser un repas pour des amis",
  "À la fromagerie — découvrir les fromages français",
  // 🍽️ Restaurant & Café
  "Au restaurant — commander un repas",
  "Au café — retrouver un ami pour un café",
  "Réserver une table — appeler un restaurant",
  "Se plaindre au restaurant — un problème avec la commande",
  "Un pique-nique — organiser un déjeuner en plein air",
  // 🚆 Transports
  "À la gare — acheter un billet de train",
  "Dans le métro — demander son chemin à un passager",
  "À l'arrêt de bus — discuter avec un inconnu en attendant",
  "Chez le garagiste — la voiture est en panne",
  "À l'aéroport — faire l'enregistrement pour un vol",
  "Louer un vélo — explorer la ville à vélo",
  // 🏠 Logement
  "Visiter un appartement — chercher un nouveau logement",
  "Problème avec le voisin — la musique est trop forte la nuit",
  "Appeler le plombier — une fuite d'eau dans la cuisine",
  "À l'agence immobilière — décrire l'appartement idéal",
  "Emménager — s'installer dans un nouveau quartier",
  // 🏥 Santé
  "Chez le médecin — avoir mal à la tête depuis 3 jours",
  "À la pharmacie — acheter des médicaments sans ordonnance",
  "Prendre rendez-vous — appeler le cabinet médical",
  "Parler de sa forme — discuter de ses habitudes de santé",
  "Chez le dentiste — un rendez-vous de contrôle",
  // 📚 Études & Formation
  "S'inscrire à un cours de langue — choisir une formation",
  "À la bibliothèque — chercher un livre pour un exposé",
  "Parler de ses études — décrire son parcours scolaire",
  "Un projet de groupe — organiser le travail avec des camarades",
  "La rentrée scolaire — préparer la nouvelle année",
  // 💼 Travail
  "Un entretien d'embauche — se présenter pour un poste",
  "Parler de son métier — décrire son travail quotidien",
  "Un problème au bureau — un malentendu avec un collègue",
  "Demander un congé — planifier des vacances",
  "Le télétravail — les avantages et inconvénients",
  "Un stage — chercher un stage d'été",
  // 🎭 Loisirs & Sorties
  "Au cinéma — choisir un film avec un ami",
  "Organiser une fête d'anniversaire — les préparatifs",
  "Au parc — une promenade et une rencontre imprévue",
  "Au musée — visiter une exposition d'art",
  "S'inscrire à la salle de sport — choisir un abonnement",
  "Un concert — parler de ses goûts musicaux",
  "Un cours de cuisine — apprendre une recette française",
  // ✈️ Voyages
  "À l'hôtel — faire le check-in et demander des infos",
  "À l'office de tourisme — demander des conseils de visite",
  "Raconter un voyage — décrire ses dernières vacances",
  "Préparer un road-trip — planifier un week-end entre amis",
  "Se perdre en ville — demander son chemin",
  "À la plage — discuter des activités de vacances",
  // 👥 Relations sociales
  "Faire connaissance — se présenter à une soirée",
  "Inviter un ami — proposer une sortie au cinéma",
  "Chercher un cadeau — un anniversaire approche",
  "Retrouver un vieil ami — des nouvelles après longtemps",
  "Présenter sa famille — parler de ses proches",
  "Un nouveau voisin — accueillir quelqu'un dans l'immeuble",
  // 🏛️ Services & Administration
  "À la banque — ouvrir un compte ou un problème bancaire",
  "À la poste — envoyer un colis à l'étranger",
  "À la mairie — faire une démarche administrative",
  "Chez le coiffeur — choisir une nouvelle coupe",
  "Au pressing — déposer des vêtements",
  // 🛍️ Achats & Shopping
  "Dans un magasin de vêtements — essayer et choisir une tenue",
  "Acheter un téléphone — comparer les modèles",
  "Les soldes — chercher de bonnes affaires",
  "Échanger un article — un vêtement ne va pas",
  "À la librairie — choisir un livre",
  // 🏡 Vie quotidienne
  "La routine du matin — décrire sa matinée typique",
  "Le week-end — raconter ses activités du week-end",
  "Les tâches ménagères — partager les corvées à la maison",
  "La météo et les projets — adapter ses plans au temps",
  "Faire la cuisine — préparer un plat simple",
  // 📱 Technologie
  "Un smartphone en panne — expliquer le problème",
  "Les réseaux sociaux — parler de ses habitudes en ligne",
  "Acheter un ordinateur — demander des conseils dans un magasin",
  "Une application utile — recommander une app",
  // 🌍 Environnement & Société
  "Le tri des déchets — expliquer ses gestes écologiques",
  "Ville ou campagne — comparer les modes de vie",
  "Les transports écologiques — discuter des alternatives",
  "Le marché bio — acheter des produits locaux",
  // 📚 Éducation (DELF)
  "Les punitions à l'école — un parent discute avec le directeur d'une punition",
  "S'inscrire à un cours en ligne — demander conseil sur les MOOC à un ami",
  "Les devoirs du week-end — un enfant négocie avec ses parents pour jouer d'abord",
  "L'instruction à domicile — un parent explique son choix éducatif à un voisin curieux",
  "L'éducation musicale — inscrire son enfant au conservatoire et rencontrer le professeur",
  "Le portable à l'école — un élève se fait confisquer son téléphone par le surveillant",
  "L'orientation scolaire — un lycéen hésite entre deux filières et consulte un conseiller",
  "Les études à l'étranger — préparer un dossier d'échange universitaire avec un conseiller",
  "Les notes à l'école — un parent réagit au nouveau système d'évaluation sans notes",
  "La sécurité à l'école — le conseil discute des nouvelles mesures de sécurité",
  // 💼 Monde du travail (DELF)
  "La semaine de 4 jours — un directeur propose ce changement à son équipe",
  "Le bien-être au travail — un employé stressé en parle à un collègue de confiance",
  "La négociation salariale — demander une augmentation à son manager",
  "Le premier jour au bureau — se présenter aux collègues et découvrir les locaux",
  "Les discriminations à l'embauche — un candidat raconte sa mauvaise expérience à un ami",
  "Les emails en vacances — un collègue reçoit un message urgent pendant ses congés",
  "La fête d'entreprise — organiser le pot de départ d'un collègue apprécié",
  "Le travail des séniors — un retraité cherche un emploi à temps partiel",
  "La robotisation — un ouvrier apprend que son poste va être automatisé",
  // 🌿 Environnement (DELF)
  "Les panneaux solaires — discuter de l'installation avec un technicien spécialisé",
  "Le covoiturage — organiser un trajet quotidien avec un collègue de travail",
  "Les espaces verts — une pétition pour créer un jardin partagé dans le quartier",
  "La rénovation énergétique — demander un devis pour isoler sa maison ancienne",
  "Le vélo en ville — louer un vélo électrique et explorer un nouveau quartier",
  "Le centre de recyclage — apprendre les nouvelles règles de tri avec un employé municipal",
  "Le réchauffement climatique — discuter des vagues de chaleur récentes entre voisins",
  "La création d'une réserve naturelle — un écologiste présente son projet au conseil",
  // 📱 Médias & Internet (DELF)
  "La panne d'Internet — appeler le service client pour résoudre un problème de connexion",
  "Un achat en ligne raté — l'article reçu ne correspond pas à la commande",
  "Les podcasts — recommander un podcast passionnant à un ami et expliquer pourquoi",
  "L'addiction aux écrans — une famille instaure des règles sur l'utilisation des écrans",
  "La protection des données — un ami donne des conseils de sécurité en ligne",
  "Les fausses informations — vérifier une info douteuse vue sur un réseau social",
  "La digital detox — raconter un week-end passé sans téléphone ni Internet",
  "La publicité ciblée — se plaindre d'avoir trop de pubs personnalisées sur Internet",
  // 🎭 Loisirs & Culture (DELF)
  "Au festival de musique — choisir les concerts et organiser la journée avec des amis",
  "Les jeux de société — une soirée entre amis, choisir le jeu et expliquer les règles",
  "L'audiolivre — recommander un livre audio captivant pour un long trajet en voiture",
  "Le livre numérique — hésiter entre acheter un e-book ou un livre papier en librairie",
  "Le musée interactif — un guide essaie de passionner un groupe d'adolescents",
  "Le cinéma ou le streaming — hésiter entre sortir au cinéma ou rester chez soi",
  "Le club de lecture — discuter d'un roman récemment lu avec d'autres passionnés",
  "Les prix littéraires — un libraire prépare sa vitrine pour le Goncourt",
  // 🏛️ Société (DELF)
  "Le bénévolat — s'inscrire comme volontaire dans une association caritative",
  "La colocation intergénérationnelle — un étudiant et un retraité cohabitent",
  "Le logement en ville — chercher désespérément un appartement à un prix raisonnable",
  "L'intégration d'un nouveau voisin — accueillir une famille récemment installée",
  "L'égalité homme-femme — une femme découvre un écart de salaire avec ses collègues",
  // 🏥 Santé & Bien-être (DELF)
  "Le coach sportif — choisir un programme d'entraînement personnalisé à la salle",
  "Le nutritionniste — revoir ses habitudes alimentaires avec un spécialiste",
  "La gestion du stress — un collègue recommande la méditation et la pleine conscience",
  "Le végétarisme — expliquer son choix alimentaire lors d'un dîner entre amis",
  "L'insomnie — consulter son médecin pour des problèmes de sommeil persistants",
];

function getPersonalityFree(difficulty: string): string {
  const base = `RÔLE: Tu es un personnage français naturel dans la situation donnée (vendeur, serveur, voisin, collègue, ami...).
RÈGLES:
- Reste DANS le contexte de la situation, pose des questions CONCRÈTES liées au scénario.
- TOUJOURS terminer par une question pour relancer la conversation.
- MAXIMUM 2-3 phrases par message. Rythme RAPIDE.
- PAS d'emoji. UNIQUEMENT en français.
- NE JAMAIS répéter ce que l'étudiant dit.`;

  switch (difficulty) {
    case 'A1':
      return `${base}
NIVEAU A1 — DÉBUTANT:
- Phrases simples et courtes (environ 5-8 mots).
- Vocabulaire de base: interactions courantes, descriptions simples.
- Temps verbal: Principalement le présent, mais d'autres temps simples sont acceptés si le contexte l'exige.
- Questions directes: "Tu veux...?", "C'est combien?", "Tu aimes...?"
- Évite le vocabulaire abstrait ou les structures complexes. Reformule si l'étudiant semble perdu.`;
    case 'A2':
      return `${base}
NIVEAU A2 — ÉLÉMENTAIRE:
- Phrases un peu plus détaillées (environ 8-12 mots).
- Vocabulaire de la vie courante: achats, voyages, expériences passées, projets.
- Temps: Mélange naturel de présent, passé composé, futur.
- Connecteurs de base: "et", "mais", "parce que", "alors".`;
    case 'B1':
      return `${base}
NIVEAU B1 — INTERMÉDIAIRE:
- Phrases de complexité moyenne avec une bonne variété de connecteurs.
- Vocabulaire: opinions, sentiments, hypothèses, conseils.
- Temps: Mélange naturel de tous les temps courants (incluant imparfait, conditionnel).
- Connecteurs: "d'abord", "ensuite", "par contre", "en fait".
- Exprimer un léger désaccord ou demander des précisions pour stimuler la conversation.`;
    case 'B2':
    default:
      return `${base}
NIVEAU B2 — AVANCÉ:
- Phrases riches et nuancées, registres variés.
- Collocations et expressions idiomatiques: "quand même", "carrément", "j'en ai marre de".
- Tous les temps verbaux y compris subjonctif et conditionnel passé.
- Connecteurs avancés: "néanmoins", "en revanche", "d'autant plus que".
- Débat, contre-argumentation, opinions tranchées.
- Partager un avis personnel avant de questionner.`;
  }
}

const PERSONALITY_DELF = `PHONG CÁCH GIÁM KHẢO DELF CHUYÊN NGHIỆP:
- Đặt tiêu chuẩn cao: Yêu cầu học viên phải giải thích rõ ràng lập luận và đưa ra ví dụ cụ thể.
- Bối cảnh SỐNG ĐỘNG: Đưa ra các tình huống thi sắc bén, sát thực tế xã hội Pháp hiện nay (môi trường, công nghệ, việc làm).
- TĂNG DẦN ÁP LỰC: Đưa ra các lập luận phản bác (contre-arguments) để thử thách khả năng bảo vệ quan điểm của thí sinh.
- KHÔNG dùng emoji.`;

function buildAiRules(scenario: Scenario, difficulty: string, delfPart: string): string {
  const diff = difficulty === 'A1' ? 'A1, câu cực kỳ đơn giản.'
    : difficulty === 'A2' ? 'A2, giao tiếp hàng ngày.'
    : difficulty === 'B1' ? 'B1, giải quyết tình huống.'
    : 'B2-C1, lập luận và tranh luận.';

  if (scenario.id === 'delf') {
    let partRule = "";
    if (delfPart === '1') partRule = "PHẦN 1: Phỏng vấn có hướng dẫn. Liên tục đặt câu hỏi về bản thân thí sinh, đào sâu thêm.";
    else if (delfPart === '2') partRule = "PHẦN 2: Tương tác đóng vai. Không dễ dàng đồng ý, tạo rào cản để thí sinh phải thuyết phục.";
    else partRule = "PHẦN 3: Trình bày quan điểm. Đặt câu hỏi phản biện, yêu cầu giải thích và ví dụ cụ thể.";

    return `Bạn là giám khảo DELF. Trình độ: ${diff}
${PERSONALITY_DELF}
${partRule}
Quy tắc:
1. CHỈ TIẾNG PHÁP. KHÔNG tiếng Việt.
2. Trả lời 2-3 câu, KHÔNG khen ngợi.
3. BẮT BUỘC kết thúc bằng 1 câu hỏi/tình huống mới.
4. CHỈ TEXT, không JSON.`;
  }

  return `${getPersonalityFree(difficulty)}
SITUATION: ${scenario.prompt}
Quy tắc:
1. Trả lời TRỰC TIẾP câu cuối cùng của học viên.
2. NGẮN GỌN (2-3 câu). Luôn kết thúc bằng câu hỏi.
3. CHỈ TEXT, không JSON.
4. CHỈ TIẾNG PHÁP.`;
}

// ─── Conversation Memory ───

function buildConversationSummary(messages: Message[]): string {
  if (messages.length <= 12) {
    return messages.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.textFr || ''}`).join('\n');
  }
  // For long conversations: summarize old + keep recent
  const oldMessages = messages.slice(0, -10);
  const recentMessages = messages.slice(-10);
  const oldSummary = oldMessages.map(m => m.textFr || '').filter(Boolean).join(' | ');
  const truncated = oldSummary.length > 300 ? oldSummary.slice(-300) + '...' : oldSummary;
  const recent = recentMessages.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.textFr || ''}`).join('\n');
  return `[Tóm tắt trước đó: ${truncated}]\n\n${recent}`;
}

// ─── Hook ───

export function useChat(initialMessages: Message[] | null, defaultScenario: Scenario) {
  const stats = useStats();
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(defaultScenario);
  const [difficulty, setDifficulty] = useState<'A1' | 'A2' | 'B1' | 'B2'>('A1');
  const [delfPart, setDelfPart] = useState<'1' | '2' | '3'>('1');
  const [isGoalAchieved, setIsGoalAchieved] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Hot-swap chat history when synced from another device
  useEffect(() => {
    if (initialMessages && !isAiTyping) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const startNewSession = useCallback(async (scenario = selectedScenario, currentDifficulty = difficulty, playAudioFn?: (text: string) => void, currentDelfPart = delfPart) => {
    setMessages([]);
    setIsAiTyping(true);
    setSelectedScenario(scenario);
    setIsGoalAchieved(false);

    if (scenario.id === 'free') {
      // Pick a random real-life topic from the pool
      const topic = FREE_TOPIC_POOL[Math.floor(Math.random() * FREE_TOPIC_POOL.length)];

      // Embed the topic into the scenario so subsequent messages stay on-topic
      const freeScenario = {
        ...scenario,
        prompt: `Situation de la vie quotidienne: ${topic}. Tu joues un rôle naturel dans cette situation (vendeur, serveur, ami, collègue, voisin, etc.).`
      };
      setSelectedScenario(freeScenario);

      const levelDesc = currentDifficulty === 'A1' ? 'A1 débutant: phrases TRÈS simples (5-8 mots), vocabulaire de base, présent uniquement'
        : currentDifficulty === 'A2' ? 'A2 élémentaire: phrases courtes et claires, passé composé/futur proche OK'
        : currentDifficulty === 'B1' ? 'B1 intermédiaire: phrases avec connecteurs, opinions et sentiments'
        : 'B2 avancé: expressions idiomatiques, nuances, débat';

      try {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: `Tu es un personnage français dans cette situation: ${topic}. Niveau: ${levelDesc}. Commence avec 1-2 phrases courtes et naturelles qui plongent dans la situation. Termine par une question concrète adaptée au niveau. PAS d'emoji. Retourne JSON: {"ai_french": "...", "ai_translation": "traduction anglaise"}` },
            { role: "user", content: "Commence la conversation." }
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          temperature: 0.9
        });
        const raw = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
        const welcomeMsg: Message = { id: Date.now(), role: 'app', textFr: parsed.ai_french, textEn: parsed.ai_translation, tips: [] };
        setMessages([welcomeMsg]);
        setIsAiTyping(false);
        if (playAudioFn) playAudioFn(welcomeMsg.textFr!);
      } catch (e) {
        console.warn("Free opener Groq failed, using fallback", e);
        const fallback: Message = { id: Date.now(), role: 'app', textFr: "Bonjour ! On commence ?", textEn: "Hello! Shall we start?", tips: [] };
        setMessages([fallback]);
        setIsAiTyping(false);
        if (playAudioFn) playAudioFn(fallback.textFr!);
      }
      return;
    }

    let difficultyPrompt = "";
    if (currentDifficulty === 'A1') difficultyPrompt = "Trình độ A1: Rất cơ bản, quen thuộc.";
    else if (currentDifficulty === 'A2') difficultyPrompt = "Trình độ A2: Giao tiếp đời sống hàng ngày.";
    else if (currentDifficulty === 'B1') difficultyPrompt = "Trình độ B1: Nêu quan điểm cá nhân, xử lý tình huống bất ngờ.";
    else if (currentDifficulty === 'B2') difficultyPrompt = "Trình độ B2: Tranh luận xã hội, bảo vệ lập luận.";

    let startPrompt = scenario.prompt;
    let systemInstruction = `${startPrompt}. ĐỂ LUYỆN PHẢN XẠ NHANH: Hãy bắt đầu bằng một lời chào bằng tiếng Pháp và một câu hỏi RẤT NGẮN GỌN (tối đa 1-2 câu). Trình độ ngôn ngữ: ${difficultyPrompt}. Trả về ĐÚNG cấu trúc JSON sau: {\"ai_french\": \"câu tiếng Pháp\", \"ai_translation\": \"dịch tiếng Anh\"}`;

    if (scenario.id === 'delf') {
      let partInstruction = "";
      const delfTopic = getRandomTopic();
      if (currentDelfPart === '1') {
        partInstruction = `Phần 1: Entretien dirigé. Chủ đề: ${delfTopic.titleFr}. Hỏi về trải nghiệm, quan điểm cá nhân của thí sinh liên quan chủ đề này.`;
      } else if (currentDelfPart === '2') {
        const roleplayScene = getRandomScenario(delfTopic);
        partInstruction = `Phần 2: Exercice en interaction. Tình huống đóng vai: ${roleplayScene}.`;
      } else {
        const debateQuestion = getRandomDebateAngle(delfTopic);
        partInstruction = `Phần 3: Expression d'un point de vue. Câu hỏi tranh luận: ${debateQuestion}.`;
      }

      systemInstruction = `${startPrompt}. ${PERSONALITY_DELF} BẮT ĐẦU: Lấy 1 ĐỀ THI chuẩn DELF trình độ ${currentDifficulty} - ${partInstruction}. YÊU CẦU: 1. Bối cảnh HOÀN TOÀN BẰNG TIẾNG PHÁP ngắn gọn, SỐNG ĐỘNG với chi tiết cụ thể (địa điểm, nhân vật). 2. Đi thẳng vào vấn đề bằng 1-2 câu hỏi. 3. Tự động đóng vai giám khảo. Trả về JSON: {\"ai_french\": \"...\", \"ai_translation\": \"...\"}`;
    }

    try {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: "Hãy chào mừng học viên." }
          ],
          model: "llama-3.3-70b-versatile",  // Better French quality for session start
          response_format: { type: "json_object" }
        });
        
        const rawContent = completion.choices[0]?.message?.content || "{}";
        const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const response = JSON.parse(cleanContent);
        
        const welcomeMsg: Message = { id: Date.now(), role: 'app', textFr: response.ai_french, textEn: response.ai_translation, tips: [] };
        setMessages([welcomeMsg]);
        if (playAudioFn) playAudioFn(welcomeMsg.textFr!);
        
      } catch (groqError) {
        console.warn("Groq failed, falling back to Gemini for startNewSession...", groqError);
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { ai_french: { type: Type.STRING }, ai_translation: { type: Type.STRING } },
              required: ["ai_french", "ai_translation"]
            }
          },
          contents: [{ parts: [{ text: "Hãy chào mừng học viên." }] }]
        });
        const response = JSON.parse((result.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim());
        const welcomeMsg: Message = { id: Date.now(), role: 'app', textFr: response.ai_french, textEn: response.ai_translation, tips: [] };
        setMessages([welcomeMsg]);
        if (playAudioFn) playAudioFn(welcomeMsg.textFr!);
      }
    } catch (error) {
      console.error(error);
      setMessages([{ id: Date.now(), role: 'app', textFr: "Bonjour! Désolé, j'ai eu un petit problème. On recommence?", isError: true }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [selectedScenario, difficulty]);

  // ─── Main send message with STREAMING + background grammar ───

  const handleSendMessage = useCallback(async (
    textToSend: string,
    playAudioFn?: (text: string) => void,
    streamingAudio?: { start: () => Promise<void>; queue: (text: string, rate?: number) => void; finish: () => void }
  ) => {
    if (!textToSend.trim() || isAiTyping) return;

    // Cancel previous stream
    if (streamAbortRef.current) streamAbortRef.current.abort();
    const streamAbort = new AbortController();
    streamAbortRef.current = streamAbort;

    const isEvaluateCommand = textToSend.includes("Markdown Table");
    const displayUserText = isEvaluateCommand ? "🎯 Đã yêu cầu nhận xét kết quả..." : textToSend;

    const userMsgId = Date.now();
    const newUserMsg: Message = { id: userMsgId, role: 'user', textFr: displayUserText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsAiTyping(true);
    
    // Track stats
    stats.addXP(1);
    stats.addStudyMinutes(1); // Rough estimate: 1 exchange = 1 minute of active study

    try {
      const contextString = buildConversationSummary(messages);
      const groqHistory = messages.slice(-14).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.textFr || ''
      }));

      // ── Evaluate command ──
      if (isEvaluateCommand) {
        try {
          const evalCompletion = await groqSafe(() => groq.chat.completions.create({
            messages: [
              { role: "system", content: "Bạn là giám khảo tiếng Pháp. Đánh giá toàn bộ cuộc hội thoại. Trả về JSON: {\"score\": \"...\", \"strengths\": [\"...\"], \"weaknesses\": [\"...\"], \"vocabulary\": [\"...\"]}. TRẢ LỜI BẰNG TIẾNG ANH." },
              ...groqHistory
            ],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            temperature: 0.2
          }));
          const evalData = JSON.parse(evalCompletion.choices[0]?.message?.content || "{}");
          setEvaluation(evalData);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'app', textFr: "🎉 Bài thi đã được chấm xong!" }]);
        } catch (e) {
          console.error("Eval failed", e);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'app', textFr: "Désolé, lỗi khi chấm điểm.", isError: true }]);
        }
        setIsAiTyping(false);
        return;
      }



      // ── Main AI response with STREAMING ──
      const currentPrompt = selectedScenario.id === 'delf'
        ? `${selectedScenario.prompt}\nDựa vào lịch sử chat để biết vai. Tiếp tục đóng vai giám khảo tự nhiên.`
        : selectedScenario.prompt;
      
      const aiRules = buildAiRules(selectedScenario, difficulty, delfPart);
      const systemContent = `${aiRules}\n\nLịch sử:\n${contextString}`;

      const tempId = Date.now() + 1;
      setMessages(prev => [...prev, { id: tempId, role: 'app', textFr: '' }]);

      try {
        // Start streaming audio session
        if (streamingAudio) await streamingAudio.start();

        const stream = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemContent },
            ...groqHistory,
            { role: "user", content: textToSend }
          ],
          model: "llama-3.3-70b-versatile",  // 70B for best French conversation quality
          temperature: 0.72,
          stream: true
        });

        let accumulated = '';
        let sentenceBuffer = '';
        let lastUiUpdate = 0; // Throttle UI updates to prevent Safari iOS freeze

        for await (const chunk of stream) {
          if (streamAbort.signal.aborted) break;
          const delta = chunk.choices[0]?.delta?.content || '';
          accumulated += delta;
          sentenceBuffer += delta;

          // Throttle UI updates: only re-render every 150ms
          // Without this, Safari iOS freezes from hundreds of re-renders/sec
          const now = Date.now();
          if (now - lastUiUpdate > 150) {
            lastUiUpdate = now;
            const textSnapshot = accumulated; // Capture for closure
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === tempId);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], textFr: textSnapshot };
                return updated;
              }
              return prev;
            });
          }

          // Queue TTS as early as possible — don't wait for full sentence
          if (streamingAudio) {
            const trimmed = sentenceBuffer.trim();
            const hasEndPunct = RE_END_PUNCT.test(sentenceBuffer);
            const hasMidPunct = RE_MID_PUNCT.test(sentenceBuffer);
            const shouldFlush = (hasEndPunct && trimmed.length > 15)
              || (hasMidPunct && trimmed.length > 50)
              || trimmed.length > 80;
            if (shouldFlush) {
              streamingAudio.queue(trimmed);
              sentenceBuffer = '';
            }
          }
        }

        // Final UI update — ensure all accumulated text is shown
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === tempId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], textFr: accumulated };
            return updated;
          }
          return prev;
        });

        // Queue any remaining text for TTS
        if (streamingAudio && sentenceBuffer.trim().length > 0) {
          streamingAudio.queue(sentenceBuffer.trim());
        }
        if (streamingAudio) streamingAudio.finish();

        // Fallback: if no streaming audio, use standard playAudio
        if (!streamingAudio && playAudioFn && accumulated) {
          playAudioFn(accumulated);
        }

        // Background translation
        groqSafe(() => groq.chat.completions.create({
          messages: [
            { role: "system", content: 'Translate the following French text to English. Return JSON with 1 field "en".' },
            { role: "user", content: accumulated }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          response_format: { type: "json_object" }
        })).then(transRes => {
          try {
            const parsed = JSON.parse(transRes.choices[0]?.message?.content || "{}");
            if (parsed.en) {
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, textEn: parsed.en } : m));
            }
          } catch(e) {}
        }).catch(e => console.error("Translation failed", e));


      } catch (e: any) {
        if (e?.name === 'AbortError') { setIsAiTyping(false); return; }
        console.warn("Groq streaming failed, falling back to Gemini...", e);
        
        // Gemini fallback (non-streaming)
        try {
          const promptContext = `Tình huống: ${currentPrompt}. Lịch sử:\n${contextString}\n\nHọc viên: ${textToSend}`;
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
              temperature: 0.7,
              systemInstruction: `${aiRules}\nTrả JSON: {"ai_french":"...","en":"..."}`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: { ai_french: { type: Type.STRING }, en: { type: Type.STRING } },
                required: ["ai_french", "en"]
              }
            },
            contents: [{ parts: [{ text: promptContext }] }]
          });
          const parsed = JSON.parse(result.text || "{}");
          const fullText = parsed.ai_french || "Désolé, je n'ai pas bien compris.";
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === tempId);
            if (idx >= 0) updated[idx] = { ...updated[idx], textFr: fullText, textEn: parsed.en };
            return updated;
          });
          if (playAudioFn) playAudioFn(fullText);
        } catch (fallbackErr) {
          console.error(fallbackErr);
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === tempId);
            if (idx >= 0) updated[idx] = { ...updated[idx], textFr: "Désolé, lỗi mạng. Vui lòng thử lại!", isError: true };
            return updated;
          });
        }
      }

      setIsAiTyping(false);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now(), role: 'app', textFr: "Bonjour! Désolé, j'ai eu un petit problème.", isError: true }]);
      setIsAiTyping(false);
    }
  }, [messages, isAiTyping, selectedScenario, difficulty, delfPart]);

  // ─── Hints ───

  const generateHintsForMessage = useCallback(async (msgId: number, aiText: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isLoadingHints: true } : m));
    
    try {
      const recentMessages = messages.slice(-10);
      const chatContext = recentMessages.map(m => `${m.role === 'user' ? 'Học viên' : 'AI'}: ${m.textFr}`).join('\n');

      let diffDesc = "";
      if (difficulty === 'A1') diffDesc = "Trình độ A1: Câu siêu ngắn, từ vựng cơ bản.";
      else if (difficulty === 'A2') diffDesc = "Trình độ A2: Trả lời đi vào trọng tâm tình huống.";
      else if (difficulty === 'B1') diffDesc = "Trình độ B1: Có giải thích lý do (parce que, car) hoặc ví dụ.";
      else diffDesc = "Trình độ B2: Lập luận chặt chẽ, từ nối logic (cependant, en effet...).";

      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          { role: "system", content: `Bạn là chuyên gia luyện thi DELF. Trả về định dạng JSON chứa mảng "hints". Nhiệm vụ của bạn là đưa ra 2-3 CÂU TRẢ LỜI CHẤT LƯỢNG CAO để học viên đáp lại câu hỏi cuối cùng của AI. YÊU CẦU: 1. Bám sát CHÍNH XÁC vào câu hỏi. 2. Các gợi ý nên tiếp cận theo nhiều hướng khác nhau (vd: đồng ý, phản đối, hoặc một lý do khác). 3. ${diffDesc} Cấu trúc JSON: { "hints": [{ "french": "...", "english": "..." }] }` },
          { role: "user", content: `Ngữ cảnh hội thoại:\n${chatContext}\n\nGiám khảo (AI) vừa hỏi: ${aiText}\n\nHãy gợi ý 2-3 cách trả lời thuyết phục và đúng trọng tâm nhất cho câu hỏi này. Translate the meaning to English.` }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        response_format: { type: "json_object" }
      }));
      
      let data;
      try {
        data = JSON.parse(completion.choices[0]?.message?.content || "{}");
      } catch(e) {
        data = { hints: [] };
      }
      const hints = data.hints || [];
      const mappedTips = hints.map((h: any) => ({ title: h.french, desc: h.english || h.vietnamese }));
      
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, tips: mappedTips, isLoadingHints: false } : m));
    } catch (e) {
      console.error("Hints failed", e);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isLoadingHints: false } : m));
    }
  }, [messages]);

  return {
    messages,
    setMessages,
    isAiTyping,
    selectedScenario,
    setSelectedScenario,
    difficulty,
    setDifficulty,
    isGoalAchieved,
    startNewSession,
    handleSendMessage,
    generateHintsForMessage,
    delfPart,
    setDelfPart,
    evaluation,
    setEvaluation
  };
}
