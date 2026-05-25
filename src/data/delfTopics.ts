// ─── Centralized DELF Topic Bank ───
// 5 major categories with 50+ sub-topics, usable across ALL levels (A1–B2).
// Each topic has a French title, Vietnamese translation, and conversation-ready scenarios.

export interface DelfTopic {
  /** French title of the topic */
  titleFr: string;
  /** Vietnamese translation */
  titleVi: string;
  /** Category key */
  category: DelfCategory;
  /** 
   * Concrete conversation scenarios for FREE mode (role-play style).
   * These are adapted per level at runtime via AI prompts.
   */
  scenarios: string[];
  /**
   * Discussion/debate angles for DELF exam mode (opinion/argumentation).
   */
  debateAngles: string[];
}

export type DelfCategory =
  | 'etudes'
  | 'travail'
  | 'environnement'
  | 'medias'
  | 'loisirs'
  | 'societe'
  | 'sante'
  | 'vie_quotidienne';

export interface CategoryInfo {
  id: DelfCategory;
  labelFr: string;
  labelVi: string;
  emoji: string;
  color: string; // tailwind color class
}

export const DELF_CATEGORIES: CategoryInfo[] = [
  { id: 'etudes', labelFr: 'Les Études', labelVi: 'Giáo dục', emoji: '📚', color: 'blue' },
  { id: 'travail', labelFr: 'Le Travail', labelVi: 'Công việc', emoji: '💼', color: 'amber' },
  { id: 'environnement', labelFr: "L'Environnement", labelVi: 'Môi trường', emoji: '🌿', color: 'green' },
  { id: 'medias', labelFr: 'Médias & Internet', labelVi: 'Truyền thông', emoji: '📱', color: 'purple' },
  { id: 'loisirs', labelFr: 'Loisirs & Culture', labelVi: 'Giải trí', emoji: '🎭', color: 'pink' },
  { id: 'societe', labelFr: 'La Société', labelVi: 'Xã hội', emoji: '🏛️', color: 'indigo' },
  { id: 'sante', labelFr: 'La Santé', labelVi: 'Sức khỏe', emoji: '🏥', color: 'red' },
  { id: 'vie_quotidienne', labelFr: 'Vie Quotidienne', labelVi: 'Đời sống', emoji: '🏠', color: 'slate' },
];

export const DELF_TOPICS: DelfTopic[] = [
  // ═══════════════════════════════════════
  // 1. LES ÉTUDES — Giáo dục & Học tập
  // ═══════════════════════════════════════
  {
    titleFr: 'Les punitions à l\'école',
    titleVi: 'Hình phạt ở trường học',
    category: 'etudes',
    scenarios: [
      "Un parent discute avec le directeur d'école — son enfant a été puni injustement",
      "Deux collègues enseignants débattent des punitions adaptées pour les élèves",
      "Un élève explique à ses parents pourquoi il a été puni aujourd'hui",
    ],
    debateAngles: [
      "Les punitions sont-elles encore efficaces pour éduquer les enfants ?",
      "Faut-il remplacer les punitions par des méthodes alternatives ?",
      "L'interdiction des punitions corporelles : une avancée ou un problème ?",
    ],
  },
  {
    titleFr: 'Les MOOC',
    titleVi: 'Các khóa học trực tuyến quy mô lớn',
    category: 'etudes',
    scenarios: [
      "Un étudiant s'inscrit à un MOOC — il demande conseil à un ami",
      "Un professeur propose de créer un MOOC pour son université",
      "Discuter de son expérience avec les cours en ligne pendant le confinement",
    ],
    debateAngles: [
      "Les MOOC vont-ils remplacer l'enseignement traditionnel ?",
      "Les diplômes en ligne ont-ils la même valeur que les diplômes classiques ?",
      "L'éducation en ligne est-elle accessible à tous ?",
    ],
  },
  {
    titleFr: 'Les devoirs pendant le week-end',
    titleVi: 'Bài tập về nhà vào cuối tuần',
    category: 'etudes',
    scenarios: [
      "Un enfant négocie avec ses parents pour jouer avant de faire ses devoirs",
      "Des parents discutent entre eux de la charge de devoirs de leurs enfants",
      "Un professeur explique aux parents pourquoi il donne des devoirs le week-end",
    ],
    debateAngles: [
      "Faut-il supprimer les devoirs le week-end ?",
      "Les devoirs à la maison creusent-ils les inégalités sociales ?",
      "Le temps libre est-il plus important que les devoirs pour le développement des enfants ?",
    ],
  },
  {
    titleFr: "L'école à la maison",
    titleVi: 'Dạy học tại nhà',
    category: 'etudes',
    scenarios: [
      "Un parent explique pourquoi il a choisi l'instruction en famille",
      "Un fonctionnaire de l'éducation rend visite à une famille pratiquant l'école à la maison",
      "Deux amis comparent l'école traditionnelle et l'école à la maison",
    ],
    debateAngles: [
      "L'école à la maison favorise-t-elle l'isolement social ?",
      "Les parents sont-ils toujours compétents pour enseigner ?",
      "Faut-il encadrer davantage l'instruction en famille ?",
    ],
  },
  {
    titleFr: 'La suppression des notes',
    titleVi: 'Bỏ việc chấm điểm',
    category: 'etudes',
    scenarios: [
      "Un professeur annonce un nouveau système d'évaluation sans notes chiffrées",
      "Des parents réagissent à la suppression des notes dans l'école de leur enfant",
      "Un élève compare son ancienne école (avec notes) à sa nouvelle école (sans notes)",
    ],
    debateAngles: [
      "Les notes motivent-elles ou découragent-elles les élèves ?",
      "Peut-on évaluer efficacement sans utiliser de notes ?",
      "La suppression des notes prépare-t-elle mal les élèves à la compétition professionnelle ?",
    ],
  },
  {
    titleFr: "L'éducation musicale des enfants",
    titleVi: 'Giáo dục âm nhạc cho trẻ em',
    category: 'etudes',
    scenarios: [
      "Un parent inscrit son enfant au conservatoire — discussion avec le professeur de musique",
      "Un enfant veut arrêter le piano — conversation avec ses parents",
      "Deux parents discutent des bienfaits de la musique sur le développement des enfants",
    ],
    debateAngles: [
      "L'éducation musicale devrait-elle être obligatoire à l'école ?",
      "Apprendre un instrument aide-t-il à mieux réussir dans les autres matières ?",
      "La musique classique vs la musique moderne : que faut-il enseigner aux enfants ?",
    ],
  },
  {
    titleFr: "L'éducation globale",
    titleVi: 'Giáo dục toàn diện',
    category: 'etudes',
    scenarios: [
      "Un directeur d'école présente un programme d'éducation globale aux parents",
      "Un étudiant parle de son expérience dans une école à pédagogie alternative",
      "Discuter des compétences essentielles pour le XXIe siècle avec un collègue",
    ],
    debateAngles: [
      "L'école doit-elle aussi enseigner les compétences émotionnelles et sociales ?",
      "L'éducation doit-elle s'adapter au monde du travail ou former des citoyens ?",
      "Les systèmes éducatifs alternatifs (Montessori, Freinet) sont-ils meilleurs ?",
    ],
  },
  {
    titleFr: "Le téléphone portable à l'école",
    titleVi: 'Điện thoại di động ở trường học',
    category: 'etudes',
    scenarios: [
      "Un élève se fait confisquer son téléphone — discussion avec le surveillant",
      "Un parent appelle l'école pour se plaindre de l'interdiction du portable",
      "Des professeurs discutent de l'utilisation pédagogique des smartphones",
    ],
    debateAngles: [
      "Faut-il interdire totalement les portables à l'école ?",
      "Le smartphone peut-il devenir un outil pédagogique ?",
      "L'interdiction du portable protège-t-elle les enfants du cyberharcèlement ?",
    ],
  },
  {
    titleFr: "La sécurité à l'école",
    titleVi: 'An ninh tại trường học',
    category: 'etudes',
    scenarios: [
      "Un parent s'inquiète de la sécurité et en parle au directeur",
      "Le conseil d'école discute de nouvelles mesures de sécurité",
      "Un enfant raconte à ses parents un exercice d'évacuation à l'école",
    ],
    debateAngles: [
      "Les caméras de surveillance dans les écoles sont-elles nécessaires ?",
      "Comment concilier sécurité et liberté dans les établissements scolaires ?",
      "Le harcèlement scolaire est-il le plus grand problème de sécurité à l'école ?",
    ],
  },
  {
    titleFr: "Le handicap à l'école",
    titleVi: 'Người khuyết tật trong môi trường học đường',
    category: 'etudes',
    scenarios: [
      "Un parent d'enfant handicapé rencontre le professeur pour la rentrée",
      "Un assistant de vie scolaire discute avec l'enseignant de l'intégration d'un élève",
      "Deux élèves parlent de leur camarade qui a des besoins spécifiques",
    ],
    debateAngles: [
      "L'inclusion scolaire est-elle toujours bénéfique pour les enfants handicapés ?",
      "Les écoles ont-elles assez de moyens pour accueillir les élèves en situation de handicap ?",
      "Faut-il privilégier les classes spécialisées ou l'intégration dans les classes ordinaires ?",
    ],
  },

  // ═══════════════════════════════════════
  // 2. LE MONDE DU TRAVAIL — Công việc
  // ═══════════════════════════════════════
  {
    titleFr: 'Le temps de travail',
    titleVi: 'Thời gian làm việc',
    category: 'travail',
    scenarios: [
      "Un employé demande un aménagement de ses horaires à son manager",
      "Deux collègues comparent leurs rythmes de travail",
      "Un candidat négocie ses conditions de travail lors d'un entretien",
    ],
    debateAngles: [
      "Faut-il réduire le temps de travail pour améliorer la productivité ?",
      "La loi des 35 heures est-elle toujours adaptée à notre époque ?",
      "Travailler plus pour gagner plus : mythe ou réalité ?",
    ],
  },
  {
    titleFr: 'Le bien-être au travail',
    titleVi: 'Sự thoải mái & hạnh phúc trong công việc',
    category: 'travail',
    scenarios: [
      "Un DRH présente un nouveau programme de bien-être aux employés",
      "Un employé stressé en parle à un collègue de confiance",
      "Une discussion entre amis sur l'importance de l'épanouissement au travail",
    ],
    debateAngles: [
      "Le bonheur au travail est-il possible pour tout le monde ?",
      "Les entreprises ont-elles une responsabilité dans le bien-être de leurs employés ?",
      "Le burn-out est-il un problème individuel ou sociétal ?",
    ],
  },
  {
    titleFr: 'Le travail des séniors',
    titleVi: 'Việc làm của người lớn tuổi',
    category: 'travail',
    scenarios: [
      "Un senior cherche un emploi — entretien avec un recruteur",
      "Un manager hésite entre recruter un jeune ou un senior",
      "Un sénior partage son expérience de reconversion professionnelle",
    ],
    debateAngles: [
      "L'expérience des séniors est-elle suffisamment valorisée en entreprise ?",
      "Faut-il repousser l'âge de la retraite ?",
      "Les séniors face aux nouvelles technologies : obstacle ou opportunité ?",
    ],
  },
  {
    titleFr: 'Le télétravail',
    titleVi: 'Làm việc từ xa',
    category: 'travail',
    scenarios: [
      "Un employé demande à son patron de travailler à distance 3 jours par semaine",
      "Un couple discute de l'organisation de la maison depuis le passage au télétravail",
      "Un nouveau collaborateur s'adapte à une équipe 100% en télétravail",
    ],
    debateAngles: [
      "Le télétravail améliore-t-il vraiment la qualité de vie ?",
      "Le bureau va-t-il disparaître ?",
      "Le télétravail creuse-t-il les inégalités entre les professions ?",
    ],
  },
  {
    titleFr: 'La robotisation',
    titleVi: 'Tự động hóa bằng robot',
    category: 'travail',
    scenarios: [
      "Un ouvrier apprend que son poste va être automatisé — discussion avec le syndicat",
      "Un ingénieur présente un robot à ses collègues dans l'usine",
      "Discuter avec un ami de l'impact des robots sur les métiers de demain",
    ],
    debateAngles: [
      "Les robots vont-ils remplacer les humains au travail ?",
      "L'automatisation va-t-elle créer plus d'emplois qu'elle n'en détruit ?",
      "Faut-il taxer les robots pour financer la protection sociale ?",
    ],
  },
  {
    titleFr: 'Les réseaux sociaux au travail',
    titleVi: 'Mạng xã hội trong công việc',
    category: 'travail',
    scenarios: [
      "Un manager surprend un employé sur les réseaux sociaux pendant les heures de travail",
      "L'équipe marketing discute de la stratégie réseaux sociaux de l'entreprise",
      "Un candidat découvre que le recruteur a vérifié ses profils en ligne",
    ],
    debateAngles: [
      "Les entreprises ont-elles le droit de surveiller les réseaux sociaux de leurs employés ?",
      "LinkedIn a-t-il remplacé le CV traditionnel ?",
      "Les réseaux sociaux professionnels créent-ils une pression supplémentaire ?",
    ],
  },
  {
    titleFr: 'La semaine de 4 jours',
    titleVi: 'Tuần làm việc 4 ngày',
    category: 'travail',
    scenarios: [
      "Un directeur propose à son équipe de tester la semaine de 4 jours",
      "Un employé raconte son expérience de la semaine de 4 jours à un ami",
      "Négociation entre syndicat et direction sur le passage aux 4 jours",
    ],
    debateAngles: [
      "La semaine de 4 jours est-elle réaliste pour toutes les professions ?",
      "Travailler moins, est-ce travailler mieux ?",
      "La semaine de 4 jours serait-elle bénéfique pour l'environnement ?",
    ],
  },
  {
    titleFr: "Les fêtes dans l'entreprise",
    titleVi: 'Các bữa tiệc trong công ty',
    category: 'travail',
    scenarios: [
      "L'équipe organise une fête de fin d'année au bureau",
      "Un employé hésite à participer au pot de départ d'un collègue",
      "Discuter de l'ambiance de la dernière soirée d'entreprise",
    ],
    debateAngles: [
      "Les événements d'entreprise renforcent-ils vraiment la cohésion d'équipe ?",
      "Peut-on refuser de participer aux fêtes d'entreprise sans conséquences ?",
      "Les afterworks sont-ils un outil de management déguisé ?",
    ],
  },
  {
    titleFr: "Les discriminations à l'embauche",
    titleVi: 'Phân biệt đối xử khi tuyển dụng',
    category: 'travail',
    scenarios: [
      "Un candidat pense avoir été discriminé — il en parle à un ami",
      "Un recruteur explique son processus de sélection à un collègue",
      "Un conseiller Pôle Emploi aide un demandeur d'emploi victime de discrimination",
    ],
    debateAngles: [
      "Le CV anonyme est-il une solution efficace contre les discriminations ?",
      "L'égalité des chances existe-t-elle vraiment sur le marché du travail ?",
      "Les quotas sont-ils nécessaires pour lutter contre les discriminations ?",
    ],
  },
  {
    titleFr: 'La messagerie professionnelle pendant les congés',
    titleVi: 'Tin nhắn/Email công việc trong kỳ nghỉ',
    category: 'travail',
    scenarios: [
      "Un employé reçoit des emails urgents pendant ses vacances — il appelle son manager",
      "Deux collègues discutent du droit à la déconnexion",
      "Un manager demande à un employé en congé de répondre à un client important",
    ],
    debateAngles: [
      "Le droit à la déconnexion est-il respecté dans votre pays ?",
      "Faut-il interdire les emails professionnels après 18h ?",
      "Être toujours joignable : signe de dévouement ou d'exploitation ?",
    ],
  },

  // ═══════════════════════════════════════
  // 3. L'ENVIRONNEMENT — Môi trường
  // ═══════════════════════════════════════
  {
    titleFr: 'La dépendance à la voiture',
    titleVi: 'Sự phụ thuộc vào ô tô',
    category: 'environnement',
    scenarios: [
      "Un citadin et un rural discutent de leurs moyens de transport",
      "Un couple hésite entre acheter une voiture ou utiliser les transports en commun",
      "Un maire présente un projet pour réduire la circulation automobile en centre-ville",
    ],
    debateAngles: [
      "Peut-on vivre sans voiture dans les zones rurales ?",
      "Les villes devraient-elles interdire les voitures dans les centres-villes ?",
      "La voiture électrique est-elle vraiment la solution ?",
    ],
  },
  {
    titleFr: 'Le réchauffement climatique',
    titleVi: 'Sự nóng lên toàn cầu',
    category: 'environnement',
    scenarios: [
      "Un scientifique explique le changement climatique à un groupe d'étudiants",
      "Des voisins discutent de la vague de chaleur exceptionnelle cet été",
      "Un jeune militant écologiste débat avec un sceptique du climat",
    ],
    debateAngles: [
      "Les actions individuelles suffisent-elles face au réchauffement climatique ?",
      "Les pays riches doivent-ils compenser davantage que les pays pauvres ?",
      "La jeunesse a-t-elle raison de manifester pour le climat ?",
    ],
  },
  {
    titleFr: "La création d'une réserve protégée",
    titleVi: 'Việc thành lập khu bảo tồn',
    category: 'environnement',
    scenarios: [
      "Un écologiste présente un projet de réserve naturelle au conseil municipal",
      "Un agriculteur s'oppose à la création d'une réserve sur ses terres",
      "Un guide touristique fait visiter une réserve protégée à un groupe",
    ],
    debateAngles: [
      "Les réserves naturelles sont-elles la meilleure façon de protéger la biodiversité ?",
      "Comment concilier développement économique et protection de la nature ?",
      "Les parcs nationaux devraient-ils être gratuits pour encourager les visites ?",
    ],
  },
  {
    titleFr: 'Les énergies propres',
    titleVi: 'Năng lượng sạch',
    category: 'environnement',
    scenarios: [
      "Un propriétaire envisage d'installer des panneaux solaires — discussion avec un installateur",
      "Un débat entre voisins sur l'éolienne prévue près du village",
      "Un ingénieur présente un projet d'énergie renouvelable à des investisseurs",
    ],
    debateAngles: [
      "Le nucléaire est-il une énergie propre ?",
      "Les énergies renouvelables peuvent-elles remplacer totalement les énergies fossiles ?",
      "Faut-il subventionner davantage les particuliers pour passer aux énergies propres ?",
    ],
  },
  {
    titleFr: 'Les espaces verts en ville',
    titleVi: 'Không gian xanh trong thành phố',
    category: 'environnement',
    scenarios: [
      "Des habitants pétitionnent pour créer un jardin partagé dans leur quartier",
      "Un urbaniste présente un projet de parc à un comité de quartier",
      "Deux promeneurs discutent dans un parc de la qualité de vie en ville",
    ],
    debateAngles: [
      "Les villes ont-elles besoin de plus d'espaces verts ?",
      "Les jardins partagés peuvent-ils résoudre les problèmes d'alimentation en ville ?",
      "Faut-il transformer les parkings en espaces verts ?",
    ],
  },
  {
    titleFr: 'Le tri sélectif',
    titleVi: 'Phân loại rác thải',
    category: 'environnement',
    scenarios: [
      "Un voisin explique les nouvelles règles de tri à un nouvel arrivant dans l'immeuble",
      "Un employé municipal fait une présentation sur le tri sélectif dans une école",
      "Discuter avec un ami des difficultés du tri au quotidien",
    ],
    debateAngles: [
      "Le tri sélectif est-il suffisant pour résoudre le problème des déchets ?",
      "Faut-il sanctionner les personnes qui ne trient pas leurs déchets ?",
      "Le zéro déchet est-il un objectif réaliste ?",
    ],
  },
  {
    titleFr: 'La biodiversité',
    titleVi: 'Đa dạng sinh học',
    category: 'environnement',
    scenarios: [
      "Un biologiste explique l'importance des abeilles à un groupe d'écoliers",
      "Un jardinier et son voisin discutent de la disparition des insectes",
      "Une discussion sur les espèces menacées lors d'une visite au zoo",
    ],
    debateAngles: [
      "La disparition des espèces est-elle le plus grand défi environnemental ?",
      "Les zoos contribuent-ils à la préservation de la biodiversité ?",
      "L'agriculture intensive est-elle compatible avec la protection de la biodiversité ?",
    ],
  },
  {
    titleFr: 'Le recyclage des déchets',
    titleVi: 'Tái chế rác thải',
    category: 'environnement',
    scenarios: [
      "Visiter un centre de recyclage avec un guide",
      "Un entrepreneur présente un projet de recyclage innovant",
      "Deux amis discutent de la consigne des bouteilles en plastique",
    ],
    debateAngles: [
      "Le recyclage donne-t-il bonne conscience mais ne résout rien ?",
      "Les entreprises doivent-elles être responsables du recyclage de leurs produits ?",
      "Le plastique recyclé est-il aussi bon que le plastique neuf ?",
    ],
  },
  {
    titleFr: "Les économies d'énergie",
    titleVi: 'Tiết kiệm năng lượng',
    category: 'environnement',
    scenarios: [
      "Un propriétaire discute de la rénovation énergétique de sa maison avec un artisan",
      "Un employé propose des mesures d'économie d'énergie à son entreprise",
      "Une famille décide de réduire sa consommation d'énergie — discussion autour de la table",
    ],
    debateAngles: [
      "Les écogestes individuels ont-ils un impact significatif ?",
      "Faut-il obliger les propriétaires à rénover les passoires thermiques ?",
      "Les factures d'énergie sont-elles le meilleur argument pour économiser ?",
    ],
  },
  {
    titleFr: 'Le développement durable',
    titleVi: 'Phát triển bền vững',
    category: 'environnement',
    scenarios: [
      "Un étudiant présente un projet de développement durable à sa classe",
      "Un consommateur hésite entre un produit bon marché et un produit écoresponsable",
      "Un maire explique sa stratégie de ville durable aux habitants",
    ],
    debateAngles: [
      "Le développement durable est-il compatible avec la croissance économique ?",
      "Les labels écologiques sont-ils fiables ?",
      "Le développement durable est-il un luxe réservé aux pays riches ?",
    ],
  },

  // ═══════════════════════════════════════
  // 4. LES MÉDIAS & INTERNET — Truyền thông
  // ═══════════════════════════════════════
  {
    titleFr: 'Les radios amateurs',
    titleVi: 'Đài phát thanh nghiệp dư',
    category: 'medias',
    scenarios: [
      "Un passionné de radio montre son équipement à un ami curieux",
      "Des bénévoles créent une radio associative pour leur quartier",
      "Un jeune découvre la radio amateur grâce à son grand-père",
    ],
    debateAngles: [
      "La radio a-t-elle encore un avenir face au podcast et au streaming ?",
      "Les radios communautaires jouent-elles un rôle important dans la démocratie ?",
      "Internet a-t-il tué la radio ou l'a-t-il transformée ?",
    ],
  },
  {
    titleFr: 'Vivre sans Internet',
    titleVi: 'Sống thiếu Internet',
    category: 'medias',
    scenarios: [
      "La connexion Internet est coupée pendant une semaine — une famille s'organise",
      "Un ami raconte son expérience de « digital detox » en montagne",
      "Un adolescent doit passer un week-end sans Internet — réaction",
    ],
    debateAngles: [
      "Peut-on encore vivre sans Internet au XXIe siècle ?",
      "La « digital detox » est-elle bénéfique pour la santé mentale ?",
      "Internet est-il un droit fondamental ?",
    ],
  },
  {
    titleFr: 'Les fausses informations',
    titleVi: 'Tin giả',
    category: 'medias',
    scenarios: [
      "Un parent découvre que son enfant partage des fake news — discussion",
      "Un journaliste explique comment vérifier une information à des étudiants",
      "Deux amis ne sont pas d'accord sur la véracité d'une info vue sur Internet",
    ],
    debateAngles: [
      "Comment lutter efficacement contre les fake news ?",
      "Les réseaux sociaux sont-ils les principaux responsables de la désinformation ?",
      "Faut-il une éducation aux médias obligatoire à l'école ?",
    ],
  },
  {
    titleFr: 'La journée sans portable',
    titleVi: 'Một ngày không dùng điện thoại di động',
    category: 'medias',
    scenarios: [
      "Une école organise une journée sans portable — réaction des élèves",
      "Un couple essaie de passer un dimanche sans téléphone",
      "Un employé oublie son téléphone chez lui — sa journée est transformée",
    ],
    debateAngles: [
      "Sommes-nous devenus dépendants de nos smartphones ?",
      "Une journée sans portable est-elle réaliste de nos jours ?",
      "Le smartphone nous rend-il plus productifs ou plus distraits ?",
    ],
  },
  {
    titleFr: 'Les jeunes et la presse',
    titleVi: 'Giới trẻ và báo chí',
    category: 'medias',
    scenarios: [
      "Un prof de lycée encourage ses élèves à lire le journal — leurs réactions",
      "Un jeune journaliste présente son métier à des collégiens",
      "Deux amis discutent de leurs sources d'information préférées",
    ],
    debateAngles: [
      "Les jeunes ne lisent plus la presse : vrai problème ou évolution normale ?",
      "Les journaux en ligne peuvent-ils remplacer la presse papier ?",
      "La presse gratuite a-t-elle dévalué le journalisme ?",
    ],
  },
  {
    titleFr: 'La publicité',
    titleVi: 'Quảng cáo',
    category: 'medias',
    scenarios: [
      "Une agence de pub présente une campagne à un client exigeant",
      "Deux amis discutent d'une publicité controversée vue à la télé",
      "Un consommateur se plaint d'avoir trop de publicités ciblées sur Internet",
    ],
    debateAngles: [
      "La publicité nous manipule-t-elle ?",
      "Faut-il interdire la publicité destinée aux enfants ?",
      "Les influenceurs sont-ils la nouvelle forme de publicité ?",
    ],
  },
  {
    titleFr: "Les impacts d'Internet sur l'économie",
    titleVi: 'Tác động của Internet đối với nền kinh tế',
    category: 'medias',
    scenarios: [
      "Un commerçant traditionnel discute avec un vendeur en ligne",
      "Un entrepreneur explique comment Internet a transformé son business",
      "Un économiste présente les chiffres du commerce en ligne à un séminaire",
    ],
    debateAngles: [
      "Le commerce en ligne menace-t-il les petits commerces ?",
      "L'économie numérique crée-t-elle plus d'emplois qu'elle n'en détruit ?",
      "Les géants du numérique (GAFA) paient-ils leur juste part d'impôts ?",
    ],
  },
  {
    titleFr: 'Les jeunes et les réseaux sociaux',
    titleVi: 'Giới trẻ và mạng xã hội',
    category: 'medias',
    scenarios: [
      "Un parent découvre le compte TikTok de son enfant de 12 ans",
      "Un psychologue parle des effets des réseaux sociaux sur les adolescents",
      "Des amis comparent leur temps d'écran sur les réseaux sociaux",
    ],
    debateAngles: [
      "Les réseaux sociaux sont-ils dangereux pour les adolescents ?",
      "Faut-il un âge minimum pour s'inscrire sur les réseaux sociaux ?",
      "Les réseaux sociaux favorisent-ils les relations superficielles ?",
    ],
  },
  {
    titleFr: 'La protection des données personnelles',
    titleVi: 'Bảo vệ dữ liệu cá nhân',
    category: 'medias',
    scenarios: [
      "Un utilisateur s'inquiète après un piratage de ses données — appel au service client",
      "Un expert en cybersécurité donne des conseils à un groupe de séniors",
      "Deux amis discutent de la collecte de données par les applications",
    ],
    debateAngles: [
      "Nos données personnelles sont-elles suffisamment protégées ?",
      "Le RGPD a-t-il changé les pratiques des entreprises ?",
      "Acceptons-nous de sacrifier notre vie privée pour des services gratuits ?",
    ],
  },
  {
    titleFr: "L'impact d'Internet sur l'intelligence",
    titleVi: 'Ảnh hưởng của Internet đối với trí thông minh',
    category: 'medias',
    scenarios: [
      "Un professeur et un parent discutent de l'effet de Google sur la mémoire des enfants",
      "Un neuroscientifique présente ses recherches sur le cerveau et les écrans",
      "Deux étudiants débattent : Internet nous rend-il plus intelligents ou plus paresseux ?",
    ],
    debateAngles: [
      "Internet nous rend-il stupides en nous empêchant de mémoriser ?",
      "L'intelligence artificielle va-t-elle compléter ou remplacer l'intelligence humaine ?",
      "Le multitâche numérique détruit-il notre capacité de concentration ?",
    ],
  },

  // ═══════════════════════════════════════
  // 5. LES LOISIRS ET LA CULTURE — Giải trí
  // ═══════════════════════════════════════
  {
    titleFr: 'Le jeu vidéo',
    titleVi: 'Trò chơi điện tử',
    category: 'loisirs',
    scenarios: [
      "Un parent limite le temps de jeu vidéo de son enfant — conflit",
      "Deux amis jouent en ligne ensemble et discutent de leurs jeux préférés",
      "Un joueur professionnel d'e-sport explique son métier à sa famille",
    ],
    debateAngles: [
      "Les jeux vidéo sont-ils une forme d'art ou juste un divertissement ?",
      "Les jeux vidéo rendent-ils les jeunes violents ?",
      "L'e-sport devrait-il être reconnu comme un vrai sport ?",
    ],
  },
  {
    titleFr: 'La fermeture des cinémas',
    titleVi: 'Sự đóng cửa của các rạp chiếu phim',
    category: 'loisirs',
    scenarios: [
      "Un cinéphile apprend que son cinéma de quartier ferme — discussion avec un ami",
      "Un exploitant de cinéma cherche des solutions pour attirer plus de spectateurs",
      "Deux amis hésitent entre aller au cinéma ou regarder un film en streaming",
    ],
    debateAngles: [
      "Le streaming va-t-il tuer les cinémas ?",
      "L'expérience du cinéma est-elle irremplaçable ?",
      "Les salles de cinéma doivent-elles se réinventer pour survivre ?",
    ],
  },
  {
    titleFr: 'Les cirques sans animaux',
    titleVi: 'Rạp xiếc không sử dụng động vật',
    category: 'loisirs',
    scenarios: [
      "Un cirque annonce qu'il n'utilisera plus d'animaux — réaction du public",
      "Un ancien dresseur raconte sa reconversion professionnelle",
      "Un parent explique à son enfant pourquoi le cirque n'a plus de lions",
    ],
    debateAngles: [
      "Faut-il interdire les animaux dans les cirques ?",
      "Un cirque sans animaux est-il moins spectaculaire ?",
      "Les droits des animaux doivent-ils primer sur la tradition ?",
    ],
  },
  {
    titleFr: 'Les événements culturels en ville',
    titleVi: 'Các sự kiện văn hóa trong thành phố',
    category: 'loisirs',
    scenarios: [
      "L'office de tourisme présente le programme culturel de l'été à un visiteur",
      "Deux amis choisissent un festival ou un concert pour le week-end",
      "Un organisateur d'événements culturels cherche des bénévoles",
    ],
    debateAngles: [
      "La culture est-elle accessible à tous dans les grandes villes ?",
      "Les fêtes de quartier renforcent-elles le lien social ?",
      "Les villes investissent-elles assez dans la culture ?",
    ],
  },
  {
    titleFr: 'Les jeux de société',
    titleVi: 'Board game',
    category: 'loisirs',
    scenarios: [
      "Une soirée jeux de société entre amis — choisir le jeu",
      "Un vendeur de boutique de jeux conseille un client",
      "Une famille retrouve le plaisir des jeux de société pendant les vacances",
    ],
    debateAngles: [
      "Les jeux de société sont-ils un meilleur divertissement que les écrans ?",
      "Pourquoi les jeux de société connaissent-ils un renouveau ?",
      "Les jeux de société peuvent-ils être éducatifs ?",
    ],
  },
  {
    titleFr: 'La fréquentation des musées',
    titleVi: 'Tần suất tham quan bảo tàng',
    category: 'loisirs',
    scenarios: [
      "Un visiteur au Louvre découvre que l'entrée est gratuite le premier dimanche du mois",
      "Un guide de musée essaie de rendre une visite intéressante pour des adolescents",
      "Deux amis débattent : les musées sont-ils ennuyeux ou passionnants ?",
    ],
    debateAngles: [
      "Les musées doivent-ils être gratuits pour tous ?",
      "Comment rendre les musées plus attractifs pour les jeunes ?",
      "Les musées virtuels peuvent-ils remplacer les visites physiques ?",
    ],
  },
  {
    titleFr: 'Les bienfaits de la lecture',
    titleVi: 'Lợi ích của việc đọc sách',
    category: 'loisirs',
    scenarios: [
      "Un libraire recommande un roman à un client indécis",
      "Un professeur encourage un élève qui n'aime pas lire",
      "Deux amis partagent leurs coups de cœur littéraires du mois",
    ],
    debateAngles: [
      "La lecture est-elle la meilleure façon de s'enrichir intellectuellement ?",
      "Les jeunes lisent-ils moins qu'avant ou lisent-ils différemment ?",
      "Faut-il obliger les enfants à lire ou les laisser venir à la lecture naturellement ?",
    ],
  },
  {
    titleFr: 'Le livre numérique',
    titleVi: 'Sách điện tử',
    category: 'loisirs',
    scenarios: [
      "Un lecteur hésite entre acheter un livre papier ou un e-book",
      "Un éditeur explique l'avenir du livre numérique à un salon",
      "Un ami offre une liseuse électronique à quelqu'un qui ne connaît pas",
    ],
    debateAngles: [
      "Le livre numérique va-t-il remplacer le livre papier ?",
      "L'e-book est-il aussi agréable à lire que le livre papier ?",
      "Le prix des livres numériques est-il justifié ?",
    ],
  },
  {
    titleFr: "L'audiolivre (le livre audio)",
    titleVi: 'Sách nói',
    category: 'loisirs',
    scenarios: [
      "Un ami recommande un audiolivre passionnant pour un long trajet en voiture",
      "Un éditeur de livres audio cherche des narrateurs — audition",
      "Un lecteur compare son expérience de lecture papier et audio",
    ],
    debateAngles: [
      "Écouter un livre, est-ce vraiment « lire » ?",
      "Les audiolivres sont-ils l'avenir de la lecture ?",
      "Les audiolivres aident-ils les personnes dyslexiques ou malvoyantes ?",
    ],
  },
  {
    titleFr: 'Les prix littéraires',
    titleVi: 'Các giải thưởng văn học',
    category: 'loisirs',
    scenarios: [
      "Un libraire prépare sa vitrine pour le Goncourt — discussion avec un client",
      "Un auteur raconte comment le prix a changé sa vie",
      "Deux amis discutent du livre qui vient de gagner un prix littéraire",
    ],
    debateAngles: [
      "Les prix littéraires reflètent-ils la qualité ou le marketing ?",
      "Les prix littéraires influencent-ils trop les ventes de livres ?",
      "Y a-t-il trop de prix littéraires en France ?",
    ],
  },

  // ═══════════════════════════════════════
  // BONUS: LA SOCIÉTÉ — Xã hội (thêm đa dạng)
  // ═══════════════════════════════════════
  {
    titleFr: 'Le bénévolat',
    titleVi: 'Tình nguyện',
    category: 'societe',
    scenarios: [
      "Un étudiant s'inscrit comme bénévole dans une association caritative",
      "Un manager encourage ses employés à faire du bénévolat de compétences",
      "Un retraité raconte son expérience de bénévole aux Restos du Cœur",
    ],
    debateAngles: [
      "Le bénévolat devrait-il être obligatoire pour les jeunes ?",
      "Le bénévolat peut-il remplacer un emploi rémunéré ?",
      "Les entreprises qui encouragent le bénévolat le font-elles pour l'image ?",
    ],
  },
  {
    titleFr: "L'égalité homme-femme",
    titleVi: 'Bình đẳng giới',
    category: 'societe',
    scenarios: [
      "Une femme négocie son salaire après avoir découvert un écart avec ses collègues masculins",
      "Un père au foyer explique son choix à un ami surpris",
      "Deux collègues discutent de la représentation des femmes dans la direction",
    ],
    debateAngles: [
      "L'égalité salariale est-elle possible sans quotas ?",
      "Les stéréotypes de genre persistent-ils dans l'éducation ?",
      "Le congé parental devrait-il être le même pour les pères et les mères ?",
    ],
  },
  {
    titleFr: 'Le logement en ville',
    titleVi: 'Nhà ở trong thành phố',
    category: 'societe',
    scenarios: [
      "Un jeune couple cherche désespérément un appartement à Paris",
      "Un propriétaire et un locataire discutent de l'augmentation du loyer",
      "Des collocataires organisent la vie commune dans un petit appartement",
    ],
    debateAngles: [
      "Faut-il encadrer les loyers dans les grandes villes ?",
      "La colocation est-elle la solution au problème du logement ?",
      "Les jeunes doivent-ils quitter les grandes villes pour trouver un logement ?",
    ],
  },
  {
    titleFr: "L'immigration et l'intégration",
    titleVi: 'Di cư và hòa nhập',
    category: 'societe',
    scenarios: [
      "Un immigrant raconte son parcours d'intégration à un journaliste",
      "Un fonctionnaire aide un nouvel arrivant dans ses démarches administratives",
      "Deux voisins de cultures différentes apprennent à se connaître",
    ],
    debateAngles: [
      "L'intégration passe-t-elle d'abord par la langue ?",
      "Les immigrants enrichissent-ils la culture du pays d'accueil ?",
      "L'accueil des réfugiés est-il un devoir moral ?",
    ],
  },
  {
    titleFr: 'La solidarité intergénérationnelle',
    titleVi: 'Tình liên đới giữa các thế hệ',
    category: 'societe',
    scenarios: [
      "Un jeune aide une personne âgée à utiliser Internet — échange enrichissant",
      "Un grand-parent garde ses petits-enfants régulièrement — discussion avec sa fille",
      "Un projet de colocation intergénérationnelle entre un étudiant et un retraité",
    ],
    debateAngles: [
      "Les jeunes et les personnes âgées se comprennent-ils ?",
      "La colocation intergénérationnelle est-elle une bonne idée ?",
      "Les jeunes générations sont-elles plus individualistes ?",
    ],
  },

  // ═══════════════════════════════════════
  // BONUS: LA SANTÉ — Sức khỏe
  // ═══════════════════════════════════════
  {
    titleFr: "L'alimentation saine",
    titleVi: 'Ăn uống lành mạnh',
    category: 'sante',
    scenarios: [
      "Un nutritionniste conseille un patient qui veut mieux manger",
      "Deux amis discutent des régimes alimentaires à la mode",
      "Un parent essaie de convaincre son enfant de manger des légumes",
    ],
    debateAngles: [
      "Manger bio est-il vraiment meilleur pour la santé ?",
      "Le véganisme est-il un mode de vie plus sain ?",
      "Faut-il taxer la malbouffe pour encourager une alimentation saine ?",
    ],
  },
  {
    titleFr: 'Le sport et la santé',
    titleVi: 'Thể thao và sức khỏe',
    category: 'sante',
    scenarios: [
      "Un médecin recommande à son patient de faire plus d'exercice",
      "Un ami convainc un autre de s'inscrire à la salle de sport",
      "Un coureur raconte sa préparation pour le marathon de Paris",
    ],
    debateAngles: [
      "Le sport est-il le meilleur médicament ?",
      "Les salles de sport sont-elles accessibles à tous ?",
      "Le sport de compétition est-il bon pour la santé ?",
    ],
  },
  {
    titleFr: 'Le stress et la santé mentale',
    titleVi: 'Stress và sức khỏe tinh thần',
    category: 'sante',
    scenarios: [
      "Un employé stressé consulte un psychologue pour la première fois",
      "Deux collègues discutent de la méditation comme outil anti-stress",
      "Un étudiant parle de son anxiété pendant la période des examens",
    ],
    debateAngles: [
      "La santé mentale est-elle aussi importante que la santé physique ?",
      "Le stress au travail est-il le mal du siècle ?",
      "Faut-il parler plus ouvertement de santé mentale dans la société ?",
    ],
  },

  // ═══════════════════════════════════════
  // BONUS: VIE QUOTIDIENNE — Đời sống
  // ═══════════════════════════════════════
  {
    titleFr: 'La consommation responsable',
    titleVi: 'Tiêu dùng có trách nhiệm',
    category: 'vie_quotidienne',
    scenarios: [
      "Un client choisit entre un produit bon marché et un produit local au supermarché",
      "Deux amis discutent de l'achat de vêtements d'occasion",
      "Un vendeur de marché bio explique ses produits à un nouveau client",
    ],
    debateAngles: [
      "Acheter local peut-il sauver la planète ?",
      "La mode éthique est-elle accessible à tous les budgets ?",
      "Le boycott des grandes marques est-il efficace ?",
    ],
  },
  {
    titleFr: 'Vivre en ville vs à la campagne',
    titleVi: 'Sống ở thành phố vs nông thôn',
    category: 'vie_quotidienne',
    scenarios: [
      "Un couple hésite entre s'installer en ville ou à la campagne",
      "Un citadin passe un week-end à la campagne et compare les deux modes de vie",
      "Un agriculteur et un Parisien échangent sur leurs quotidiens respectifs",
    ],
    debateAngles: [
      "La campagne offre-t-elle une meilleure qualité de vie ?",
      "Les jeunes doivent-ils quitter la campagne pour réussir ?",
      "La fracture numérique entre ville et campagne est-elle un problème majeur ?",
    ],
  },
  {
    titleFr: 'Les transports du futur',
    titleVi: 'Giao thông tương lai',
    category: 'vie_quotidienne',
    scenarios: [
      "Un ingénieur présente un projet de transport en commun autonome",
      "Deux amis discutent de la voiture volante et du train hyperloop",
      "Un usager compare les transports en commun de Paris avec ceux de Tokyo",
    ],
    debateAngles: [
      "Les transports en commun doivent-ils être gratuits ?",
      "La voiture autonome va-t-elle révolutionner nos déplacements ?",
      "Le vélo est-il le transport urbain de l'avenir ?",
    ],
  },
];

// ─── Helper functions ───

/** Get all topics for a specific category */
export function getTopicsByCategory(category: DelfCategory): DelfTopic[] {
  return DELF_TOPICS.filter(t => t.category === category);
}

/** Get a random topic, optionally filtered by category */
export function getRandomTopic(category?: DelfCategory, excludeSet?: Set<string>): DelfTopic {
  let pool = category ? DELF_TOPICS.filter(t => t.category === category) : DELF_TOPICS;
  if (excludeSet && excludeSet.size > 0) {
    const filtered = pool.filter(t => !excludeSet.has(t.titleFr));
    if (filtered.length > 0) pool = filtered;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Get a random scenario from a topic */
export function getRandomScenario(topic: DelfTopic): string {
  return topic.scenarios[Math.floor(Math.random() * topic.scenarios.length)];
}

/** Get a random debate angle from a topic */
export function getRandomDebateAngle(topic: DelfTopic): string {
  return topic.debateAngles[Math.floor(Math.random() * topic.debateAngles.length)];
}

/** Get all topic titles as a flat list (for sentence builder, QA, etc.) */
export function getAllTopicTitlesForPractice(): string[] {
  return DELF_TOPICS.flatMap(t => [
    // The French title itself as a topic
    t.titleFr,
    // Plus one scenario for variety
    ...t.scenarios.slice(0, 1),
  ]);
}

/** Get category info by id */
export function getCategoryInfo(id: DelfCategory): CategoryInfo | undefined {
  return DELF_CATEGORIES.find(c => c.id === id);
}
