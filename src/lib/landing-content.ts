export type LandingLocale = 'fr' | 'ht' | 'en'
export type LandingIcon = 'school' | 'teaching' | 'family' | 'students' | 'attendance' | 'results' | 'finance' | 'calendar' | 'communication'

export type LandingCopy = {
  metadata: { title: string; description: string }
  brand: { subtitle: string }
  navigation: { features: string; roles: string; signIn: string; createSchool: string; skipToContent: string; security: string; aria: string }
  hero: {
    title: string
    emphasis: string
    description: string
    primary: string
    secondary: string
    previewAlt: string
    previewContext: string
    previewCaption: string
    previewTitle: string
    previewNav: string[]
    previewItems: Array<{ icon: LandingIcon; title: string; detail: string }>
  }
  introduction: { title: string; description: string }
  roles: Array<{ audience: string; title: string; description: string; icon: LandingIcon }>
  modules: { title: string; description: string; items: Array<{ icon: LandingIcon; title: string; description: string }> }
  access: { title: string; description: string }
  closing: { title: string; description: string; primary: string; secondary: string }
  pages: { featuresTitle: string; featuresDescription: string; solutionsTitle: string; solutionsDescription: string }
  footer: { tagline: string; signIn: string; createSchool: string; copyright: string }
}

const landingCopy: Record<LandingLocale, LandingCopy> = {
  fr: {
    metadata: {
      title: 'AtechOS | Gestion scolaire intégrée',
      description: 'AtechOS réunit les équipes, les familles et les élèves autour des opérations quotidiennes de l’établissement.',
    },
    brand: { subtitle: 'Gestion scolaire intégrée' },
    navigation: { features: 'Fonctionnalités', roles: 'Solutions par rôle', signIn: 'Se connecter', createSchool: 'Créer votre école', skipToContent: 'Aller au contenu', security: 'Accès', aria: 'Navigation principale' },
    hero: {
      title: 'Toute votre école,',
      emphasis: 'mieux organisée.',
      description: 'AtechOS relie la direction, les équipes pédagogiques, les familles et les élèves autour des activités quotidiennes de l’établissement.',
      primary: 'Créer votre école',
      secondary: 'Se connecter',
      previewAlt: 'Aperçu illustratif des espaces AtechOS pour la vie scolaire, la pédagogie et les finances.',
      previewContext: 'Espace école',
      previewCaption: 'Une vue organisée selon les responsabilités de chaque équipe.',
      previewTitle: 'Les espaces de votre école',
      previewNav: ['Vue d’ensemble', 'Élèves', 'Présences', 'Finances'],
      previewItems: [
        { icon: 'attendance', title: 'Vie scolaire', detail: 'Présences, calendrier et KIOS' },
        { icon: 'results', title: 'Pédagogie', detail: 'Examens, notes et bulletins' },
        { icon: 'finance', title: 'Finances', detail: 'Frais, paiements et reçus' },
      ],
    },
    introduction: {
      title: 'Du bureau de la direction au téléphone des familles.',
      description: 'Une même organisation accompagne les tâches qui rythment l’année scolaire, avec des espaces adaptés aux responsabilités de chacun.',
    },
    roles: [
      { audience: 'Direction et administration', title: 'Gardez les priorités de l’établissement en vue.', description: 'Retrouvez les dossiers, les classes et les actions à traiter dans les espaces autorisés à votre rôle.', icon: 'school' },
      { audience: 'Équipe pédagogique', title: 'Suivez les apprentissages sans perdre le fil.', description: 'Préparez les examens, saisissez les résultats et suivez les devoirs et les présences de vos classes.', icon: 'teaching' },
      { audience: 'Familles et élèves', title: 'Consultez les informations scolaires au même endroit.', description: 'Retrouvez les présences, les calendriers, les devoirs, les bulletins publiés et les paiements liés à votre dossier.', icon: 'family' },
    ],
    modules: {
      title: 'Les outils suivent le parcours de l’école.',
      description: 'Les espaces AtechOS couvrent l’organisation scolaire, le suivi pédagogique, les opérations et les échanges avec les familles.',
      items: [
        { icon: 'students', title: 'Élèves et familles', description: 'Dossiers, liens familiaux et parcours scolaire.' },
        { icon: 'attendance', title: 'Présences et KIOS', description: 'Entrées, sorties, retards et historique.' },
        { icon: 'results', title: 'Notes et examens', description: 'Évaluations, soumissions et bulletins publiés.' },
        { icon: 'finance', title: 'Comptabilité', description: 'Frais, échéances, paiements et reçus.' },
        { icon: 'calendar', title: 'Calendrier scolaire', description: 'Périodes, examens, événements et journées spéciales.' },
        { icon: 'communication', title: 'Informations scolaires', description: 'Notifications et actualités selon les accès autorisés.' },
      ],
    },
    access: {
      title: 'Chaque équipe retrouve son espace de travail.',
      description: 'Les menus et les actions suivent les rôles et les autorisations configurés pour l’établissement. Les informations présentées dépendent des accès du compte connecté.',
    },
    closing: {
      title: 'Une organisation plus claire pour toute l’école.',
      description: 'Découvrez AtechOS avec les espaces que votre établissement souhaite utiliser.',
      primary: 'Créer votre école',
      secondary: 'Se connecter',
    },
    pages: { featuresTitle: 'Les opérations de l’école, dans un même fil.', featuresDescription: 'Retrouvez les outils qui structurent la vie scolaire, le suivi pédagogique, les finances et les échanges avec les familles.', solutionsTitle: 'Un espace selon les responsabilités.', solutionsDescription: 'AtechOS relie les personnes qui font vivre l’établissement, tout en présentant à chacune les tâches et informations utiles à son rôle.' },
    footer: { tagline: 'Les opérations scolaires, réunies dans un seul espace.', signIn: 'Se connecter', createSchool: 'Créer votre école', copyright: 'Gestion scolaire intégrée' },
  },
  ht: {
    metadata: {
      title: 'AtechOS | Jesyon lekòl nan yon sèl sistèm',
      description: 'AtechOS mete ekip lekòl la, fanmi yo ak elèv yo ansanm pou jere aktivite lekòl chak jou.',
    },
    brand: { subtitle: 'Jesyon lekòl konplè' },
    navigation: { features: 'Fonksyonalite', roles: 'Solisyon pa wòl', signIn: 'Konekte', createSchool: 'Kreye lekòl ou', skipToContent: 'Ale nan kontni an', security: 'Aksè', aria: 'Navigasyon prensipal' },
    hero: {
      title: 'Tout lekòl ou a,',
      emphasis: 'pi byen òganize.',
      description: 'AtechOS mete direksyon, ekip pedagojik la, fanmi yo ak elèv yo nan menm espas pou aktivite lekòl chak jou.',
      primary: 'Kreye lekòl ou',
      secondary: 'Konekte',
      previewAlt: 'Apèsi ilistratif sou espas AtechOS pou lavi lekòl, pedagoji ak finans.',
      previewContext: 'Espas lekòl',
      previewCaption: 'Yon apèsi òganize selon responsablite chak ekip.',
      previewTitle: 'Espas lekòl ou yo',
      previewNav: ['Apèsi jeneral', 'Elèv', 'Prezans', 'Finans'],
      previewItems: [
        { icon: 'attendance', title: 'Lavi lekòl', detail: 'Prezans, kalandriye ak KIOS' },
        { icon: 'results', title: 'Pedagoji', detail: 'Egzamen, nòt ak bilten' },
        { icon: 'finance', title: 'Finans', detail: 'Frè, peman ak resi' },
      ],
    },
    introduction: {
      title: 'Soti nan biwo direksyon an rive nan telefòn fanmi yo.',
      description: 'Menm òganizasyon an ede ekip yo jere travay ki fèt pandan ane lekòl la, avèk espas ki adapte ak responsablite chak moun.',
    },
    roles: [
      { audience: 'Direksyon ak administrasyon', title: 'Kenbe priyorite lekòl la devan je nou.', description: 'Jwenn dosye, klas ak aksyon pou trete nan espas wòl ou otorize pou itilize yo.', icon: 'school' },
      { audience: 'Ekip pedagojik la', title: 'Swiv aprantisaj yo san pèdi fil la.', description: 'Prepare egzamen, antre rezilta epi suiv devwa ak prezans nan klas ou yo.', icon: 'teaching' },
      { audience: 'Fanmi ak elèv', title: 'Gade enfòmasyon lekòl yo nan menm kote a.', description: 'Jwenn prezans, kalandriye, devwa, bilten ki pibliye ak peman ki mache ak dosye ou.', icon: 'family' },
    ],
    modules: {
      title: 'Zouti yo suiv tout etap lavi lekòl la.',
      description: 'Espas AtechOS yo kouvri òganizasyon lekòl la, swivi pedagojik, operasyon ak kominikasyon ak fanmi yo.',
      items: [
        { icon: 'students', title: 'Elèv ak fanmi', description: 'Dosye elèv, lyen fanmi ak swivi lekòl.' },
        { icon: 'attendance', title: 'Prezans ak KIOS', description: 'Antre, sòti, reta ak istwa prezans.' },
        { icon: 'results', title: 'Nòt ak egzamen', description: 'Evalyasyon, soumisyon ak bilten ki pibliye.' },
        { icon: 'finance', title: 'Kontablite', description: 'Frè, dat limit, peman ak resi.' },
        { icon: 'calendar', title: 'Kalandriye lekòl', description: 'Peryòd, egzamen, aktivite ak jou espesyal.' },
        { icon: 'communication', title: 'Enfòmasyon lekòl', description: 'Notifikasyon ak nouvèl selon aksè ki otorize.' },
      ],
    },
    access: {
      title: 'Chak ekip jwenn espas travay pa li.',
      description: 'Meni ak aksyon yo suiv wòl ak otorizasyon lekòl la mete. Enfòmasyon ki parèt depann de aksè kont ki konekte a.',
    },
    closing: {
      title: 'Yon òganizasyon ki pi klè pou tout lekòl la.',
      description: 'Dekouvri espas AtechOS lekòl ou a vle itilize.',
      primary: 'Kreye lekòl ou',
      secondary: 'Konekte',
    },
    pages: { featuresTitle: 'Tout operasyon lekòl la, nan menm swivi a.', featuresDescription: 'Jwenn zouti pou lavi lekòl, swivi pedagojik, finans ak kominikasyon ak fanmi yo.', solutionsTitle: 'Yon espas pou chak responsablite.', solutionsDescription: 'AtechOS konekte moun k ap fè lekòl la mache, epi chak moun jwenn travay ak enfòmasyon ki itil pou wòl li.' },
    footer: { tagline: 'Tout operasyon lekòl yo, nan yon sèl espas.', signIn: 'Konekte', createSchool: 'Kreye lekòl ou', copyright: 'Jesyon lekòl konplè' },
  },
  en: {
    metadata: {
      title: 'AtechOS | Connected school management',
      description: 'AtechOS brings school teams, families, and students together around everyday school operations.',
    },
    brand: { subtitle: 'Connected school management' },
    navigation: { features: 'Features', roles: 'By role', signIn: 'Sign in', createSchool: 'Create your school', skipToContent: 'Skip to content', security: 'Access', aria: 'Main navigation' },
    hero: {
      title: 'Your whole school,',
      emphasis: 'better organized.',
      description: 'AtechOS connects school leadership, teaching teams, families, and students around the everyday work of a school.',
      primary: 'Create your school',
      secondary: 'Sign in',
      previewAlt: 'Illustrative preview of AtechOS spaces for school life, teaching, and finance.',
      previewContext: 'School workspace',
      previewCaption: 'A view organized around each team’s responsibilities.',
      previewTitle: 'Your school spaces',
      previewNav: ['Overview', 'Students', 'Attendance', 'Finance'],
      previewItems: [
        { icon: 'attendance', title: 'School life', detail: 'Attendance, calendar, and KIOS' },
        { icon: 'results', title: 'Teaching', detail: 'Exams, grades, and report cards' },
        { icon: 'finance', title: 'Finance', detail: 'Fees, payments, and receipts' },
      ],
    },
    introduction: {
      title: 'From the school office to a family’s phone.',
      description: 'One connected system supports the work that shapes the school year, with spaces suited to each person’s responsibilities.',
    },
    roles: [
      { audience: 'School leadership and administration', title: 'Keep the school’s priorities in view.', description: 'Find records, classes, and actions to review in the spaces your role is allowed to use.', icon: 'school' },
      { audience: 'Teaching teams', title: 'Track learning without losing context.', description: 'Prepare exams, enter results, and follow assignments and attendance for your classes.', icon: 'teaching' },
      { audience: 'Families and students', title: 'Find school information in one place.', description: 'See attendance, calendars, assignments, published reports, and payments linked to your account.', icon: 'family' },
    ],
    modules: {
      title: 'Tools that follow the school journey.',
      description: 'AtechOS spaces support school organization, academic work, operations, and communication with families.',
      items: [
        { icon: 'students', title: 'Students and families', description: 'Student records, family links, and school history.' },
        { icon: 'attendance', title: 'Attendance and KIOS', description: 'Arrivals, departures, lateness, and history.' },
        { icon: 'results', title: 'Grades and exams', description: 'Assessments, submissions, and published reports.' },
        { icon: 'finance', title: 'Accounting', description: 'Fees, due dates, payments, and receipts.' },
        { icon: 'calendar', title: 'School calendar', description: 'Periods, exams, events, and special days.' },
        { icon: 'communication', title: 'School updates', description: 'Notifications and updates within authorized access.' },
      ],
    },
    access: {
      title: 'Each team has a workspace for its work.',
      description: 'Menus and actions follow the roles and permissions configured for the school. Information shown depends on the signed-in account’s access.',
    },
    closing: {
      title: 'A clearer way to organize the whole school.',
      description: 'Explore the AtechOS spaces your school wants to use.',
      primary: 'Create your school',
      secondary: 'Sign in',
    },
    pages: { featuresTitle: 'School operations, connected in one view.', featuresDescription: 'Find the tools that support school life, academic work, finance, and communication with families.', solutionsTitle: 'A workspace for each responsibility.', solutionsDescription: 'AtechOS connects the people who keep a school moving and gives each role access to the work and information relevant to it.' },
    footer: { tagline: 'School operations, brought together in one place.', signIn: 'Sign in', createSchool: 'Create your school', copyright: 'Connected school management' },
  },
}

export function landingCopyFor(locale: LandingLocale): LandingCopy {
  return landingCopy[locale] ?? landingCopy.fr
}
