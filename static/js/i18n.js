// ── Translations ─────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  fr: {
    // Nav
    my_profile:      "Mon profil",
    logout:          "Déconnexion",
    // Home cards
    create_title:    "Créer une partie",
    create_desc:     "Génère un code à partager avec ton adversaire.",
    create_btn:      "Nouvelle partie →",
    code_label:      "Code à partager",
    waiting_opp:     "⏳ En attente de l'adversaire…",
    copy_btn:        "Copier",
    copied_btn:      "Copié ✓",
    join_title:      "Rejoindre une partie",
    join_desc:       "Entre le code reçu par ton ami.",
    join_placeholder:"ex : A1B2C3D4",
    join_btn:        "Rejoindre →",
    invite_title:    "Inviter un ami",
    invite_desc:     "Envoie une invitation directe à un de tes amis.",
    invite_btn:      "Inviter",
    no_friends:      "Aucun ami pour l'instant.",
    add_friends_link:"Ajouter des amis →",
    loading_friends: "Chargement des amis…",
    inv_sent:        "Invitation envoyée à",
    waiting_reply:   "⏳ En attente de la réponse…",
    // Banner
    inv_banner:      "vous invite à jouer !",
    accept:          "Accepter",
    refuse:          "Refuser",
    // Game
    status_connecting: "Connexion…",
    opponent_joined: "L'adversaire a rejoint !",
    status_waiting:  "En attente de l'adversaire…",
    status_my_turn:  "🔴 À votre tour",
    status_opp_turn: "⏳ Tour de l'adversaire",
    status_finished: "Partie terminée",
    you_won:         "Vous avez gagné 🎉",
    opp_won:         "Votre adversaire a gagné",
    opp_resigned:    "L'adversaire a abandonné !",
    you_resigned:    "Vous avez abandonné",
    opp_disconnected:"⚠ L'adversaire s'est déconnecté",
    opp_wants_rematch:"↺ Votre adversaire veut rejouer",
    resign_btn:      "Abandonner",
    rematch_btn:     "Rejouer ↺",
    home_btn:        "← Accueil",
    waiting_rematch: "⏳ En attente de l'adversaire…",
    resign_confirm:  "Abandonner la partie ?",
    history_label:   "Historique",
    you_label:       "Vous",
    opp_label:       "Adversaire",
    // Profile
    profile_title:   "Profil",
    friends_title:   "Amis",
    search_placeholder: "Chercher un pseudo…",
    pending_requests:"Demandes reçues",
    my_friends:      "Mes amis",
    no_friends_yet:  "Pas encore d'amis. Cherche un pseudo ci-dessus !",
    pending_badge:   "En attente…",
    remove_friend:   "Retirer",
    history_title:   "Historique des parties",
    no_history:      "Aucune partie jouée pour l'instant.",
    col_date:        "Date",
    col_opponent:    "Adversaire",
    col_result:      "Résultat",
    col_moves:       "Coups",
    col_replay:      "Revoir",
    win_badge:       "Victoire",
    loss_badge:      "Défaite",
    replay_btn:      "▶",
    // Login
    login_tab:       "Connexion",
    register_tab:    "Inscription",
    username_label:  "Pseudo",
    password_label:  "Mot de passe",
    username_hint:   "ton_pseudo",
    login_btn:       "Se connecter →",
    register_btn:    "Créer mon compte →",
    username_reg_label: "Pseudo (min. 3 caractères)",
    password_reg_label: "Mot de passe (min. 6 caractères)",
    // Replay
    replay_title:    "Révision de partie",
    replay_vs:       "vs",
    replay_winner:   "Vainqueur",
    replay_draw:     "Pas de vainqueur",
    replay_move:     "Coup",
    replay_of:       "sur",
    prev_btn:        "◀ Précédent",
    next_btn:        "Suivant ▶",
    back_profile:    "← Retour au profil",
  },
  mn: {
    // Nav
    my_profile:      "Миний профайл",
    logout:          "Гарах",
    // Home cards
    create_title:    "Тоглоом үүсгэх",
    create_desc:     "Өрсөлдөгчтэйгээ хуваалцах код үүсгэ.",
    create_btn:      "Шинэ тоглоом →",
    code_label:      "Хуваалцах код",
    waiting_opp:     "⏳ Өрсөлдөгчийг хүлээж байна…",
    copy_btn:        "Хуулах",
    copied_btn:      "Хуулагдлаа ✓",
    join_title:      "Тоглоомд нэгдэх",
    join_desc:       "Найзаасаа авсан кодыг оруул.",
    join_placeholder:"Жнь: A1B2C3D4",
    join_btn:        "Нэгдэх →",
    invite_title:    "Найзыг урих",
    invite_desc:     "Найздаа шууд урилга илгээ.",
    invite_btn:      "Урих",
    no_friends:      "Одоогоор найз байхгүй.",
    add_friends_link:"Найз нэмэх →",
    loading_friends: "Найзуудыг ачаалж байна…",
    inv_sent:        "Урилга илгээгдлээ:",
    waiting_reply:   "⏳ Хариу хүлээж байна…",
    // Banner
    inv_banner:      "таныг тоглоомд урьж байна!",
    accept:          "Зөвшөөрөх",
    refuse:          "Татгалзах",
    // Game
    status_connecting: "Холбогдож байна…",
    opponent_joined: "Өрсөлдөгч joined !",
    status_waiting:  "Өрсөлдөгчийг хүлээж байна…",
    status_my_turn:  "🔴 Таны ээлж",
    status_opp_turn: "⏳ Өрсөлдөгчийн ээлж",
    status_finished: "Тоглоом дууссан",
    you_won:         "Та хожлоо 🎉",
    opp_won:         "Өрсөлдөгч хожлоо",
    opp_resigned:    "Өрсөлдөгч татгалзлаа!",
    you_resigned:    "Та татгалзлаа",
    opp_disconnected:"⚠ Өрсөлдөгч салгагдлаа",
    opp_wants_rematch:"↺ Өрсөлдөгч дахин тоглохыг хүсч байна",
    resign_btn:      "Татгалзах",
    rematch_btn:     "Дахин тоглох ↺",
    home_btn:        "← Нүүр хуудас",
    waiting_rematch: "⏳ Өрсөлдөгчийг хүлээж байна…",
    resign_confirm:  "Тоглоомоос гарах уу?",
    history_label:   "Түүх",
    you_label:       "Та",
    opp_label:       "Өрсөлдөгч",
    // Profile
    profile_title:   "Профайл",
    friends_title:   "Найзууд",
    search_placeholder: "Хэрэглэгч хайх…",
    pending_requests:"Ирсэн хүсэлтүүд",
    my_friends:      "Миний найзууд",
    no_friends_yet:  "Одоогоор найз байхгүй. Дээрээс хайгаарай!",
    pending_badge:   "Хүлээгдэж байна…",
    remove_friend:   "Хасах",
    history_title:   "Тоглоомын түүх",
    no_history:      "Одоогоор тоглосон тоглоом байхгүй.",
    col_date:        "Огноо",
    col_opponent:    "Өрсөлдөгч",
    col_result:      "Үр дүн",
    col_moves:       "Нүүдэл",
    col_replay:      "Үзэх",
    win_badge:       "Ялалт",
    loss_badge:      "Ялагдал",
    replay_btn:      "▶",
    // Login
    login_tab:       "Нэвтрэх",
    register_tab:    "Бүртгүүлэх",
    username_label:  "Хэрэглэгчийн нэр",
    password_label:  "Нууц үг",
    username_hint:   "хэрэглэгчийн_нэр",
    login_btn:       "Нэвтрэх →",
    register_btn:    "Бүртгүүлэх →",
    username_reg_label: "Хэрэглэгчийн нэр (мин. 3 тэмдэгт)",
    password_reg_label: "Нууц үг (мин. 6 тэмдэгт)",
    // Replay
    replay_title:    "Тоглоом дахин үзэх",
    replay_vs:       "эсрэг",
    replay_winner:   "Ялагч",
    replay_draw:     "Ялагч байхгүй",
    replay_move:     "Нүүдэл",
    replay_of:       "/",
    prev_btn:        "◀ Өмнөх",
    next_btn:        "Дараах ▶",
    back_profile:    "← Профайл руу буцах",
  }
};

// ── Language management ───────────────────────────────────────────────────────
// ── Language management ───────────────────────────────────────────────────────
function getLang() {
  return localStorage.getItem("gomoku_lang") || "fr";
}

function setLang(lang) {
  localStorage.setItem("gomoku_lang", lang);
  applyLang(lang);
}

// Nouvelle fonction pour basculer d'une langue à l'autre
function toggleLang() {
  const currentLang = getLang();
  // Si on est en FR, on passe en MN. Sinon, on passe en FR.
  setLang(currentLang === "fr" ? "mn" : "fr");
}

function t(key) {
  const lang = getLang();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS["fr"][key] || key;
}

function applyLang(lang) {
  // 1. Mettre à jour tous les textes
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  
  // 2. Mettre à jour les placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.placeholder = t(key);
  });
  
  // 3. Mettre à jour le bouton de changement de langue (Drapeau opposé)
  const toggleBtn = document.getElementById("lang-toggle-btn");
  if (toggleBtn) {
    if (lang === "fr") {
      toggleBtn.textContent = "🇲🇳"; // Affiche le drapeau mongol
      toggleBtn.title = "Монгол хэл рүү шилжих"; // Info-bulle au survol
    } else {
      toggleBtn.textContent = "🇫🇷"; // Affiche le drapeau français
      toggleBtn.title = "Passer en Français"; // Info-bulle au survol
    }
  }
}

// Apply on load
document.addEventListener("DOMContentLoaded", () => applyLang(getLang()));