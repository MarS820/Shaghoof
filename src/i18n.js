/**
 * i18n — Bilingual translation system for Shaghoof AI.
 * Supports English (en) and Arabic (ar) with Egyptian dialect awareness.
 */

const translations = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_lessons: 'Lessons',
    nav_quiz: 'Quiz',
    nav_chat: 'AI Tutor',
    nav_settings: 'Settings',
    nav_flashcards: 'Flashcards',
    nav_assignments: 'Assignments',
    nav_podcast: 'Podcast',
    nav_knowledge: 'Knowledge Graph',

    // Common
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    search: 'Search',
    submit: 'Submit',
    retry: 'Retry',
    xp: 'XP',
    streak: 'Streak',

    // Lesson
    lesson_title: 'Lesson',
    lesson_empty: 'No lessons yet. Create one from your data sources!',
    lesson_generate: 'Generate Lesson',
    lesson_generating: 'Generating...',
    lesson_sections: 'Sections',
    lesson_concepts: 'Key Concepts',
    lesson_vocabulary: 'Vocabulary',
    lesson_objectives: 'Learning Objectives',

    // Tutor
    tutor_title: 'AI Tutor',
    tutor_placeholder: 'Ask me anything about the lesson...',
    tutor_listening: 'Listening...',
    tutor_thinking: 'Thinking...',
    tutor_offline: 'AI service unavailable. Configure GROQ_API_KEY or GEMINI_API_KEY.',

    // Quiz
    quiz_title: 'Quiz',
    quiz_generate: 'Generate Quiz',
    quiz_question: 'Question',
    quiz_correct: 'Correct!',
    quiz_wrong: 'Wrong!',
    quiz_score: 'Score',
    quiz_next: 'Next Question',

    // Podcast
    podcast_title: 'Shaghoof Podcast',
    podcast_generate: 'Generate Podcast',
    podcast_topic_placeholder: 'Enter topic...',
    podcast_play: 'Play',
    podcast_stop: 'Stop',
    podcast_dialect: 'Egyptian Dialect',

    // Feynman
    feynman_title: 'Reverse Feynman Challenge',
    feynman_topic_placeholder: 'Topic...',
    feynman_explanation_placeholder: 'Explain simply...',
    feynman_evaluate: 'Evaluate My Explanation',
    feynman_score: 'Simplicity Score',
    feynman_passed: 'Grandma Test passed',
    feynman_failed: 'Grandma Test failed',
    feynman_has_analogy: 'Has analogy',
    feynman_jargon: 'Jargon detected',

    // Knowledge Graph
    graph_title: 'Knowledge Graph',
    graph_level: 'Level',

    // Settings
    settings_title: 'Settings',
    settings_language: 'Language',
    settings_theme: 'Theme',
    settings_dark: 'Dark',
    settings_light: 'Light',
    settings_dialect: 'Egyptian Dialect',
    settings_profile: 'Profile',

    // Accessibility
    access_title: 'Accessibility',
    access_dyslexia: 'Dyslexia Font',
    access_focus: 'Focus Mode',
    access_line_focus: 'Line Focus',

    // Chat
    chat_send: 'Send',
    chat_copy: 'Copy',
    chat_listen: 'Listen',
    chat_stop: 'Stop',
    chat_hint: 'Hint',
    chat_stuck: "I'm stuck",
    chat_eli5: 'Explain simply',
    chat_deep: 'Go deeper',

    // Wordwall
    wordwall_title: 'Wordwall Activities',
    wordwall_suggested: 'Suggested Activities',
    wordwall_add_custom: 'Add Custom Wordwall Activity',
    wordwall_url_placeholder: 'Paste Wordwall URL here...',
    wordwall_add: 'Add',
    wordwall_open: 'Open in Wordwall',

    // Error
    error_title: 'Something went wrong',
    error_reload: 'Reload',
    error_clear_cache: 'Clear Cache',
  },

  ar: {
    // Navigation
    nav_home: 'الرئيسية',
    nav_lessons: 'الدروس',
    nav_quiz: 'اختبار',
    nav_chat: 'المعلّم الذكي',
    nav_settings: 'الإعدادات',
    nav_flashcards: 'بطاقات',
    nav_assignments: 'واجبات',
    nav_podcast: 'بودكاست',
    nav_knowledge: 'خريطة المعرفة',

    // Common
    loading: 'جاري التحميل...',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    close: 'إغلاق',
    back: 'رجوع',
    next: 'التالي',
    search: 'بحث',
    submit: 'إرسال',
    retry: 'إعادة المحاولة',
    xp: 'نقاط',
    streak: 'سلسلة',

    // Lesson
    lesson_title: 'الدرس',
    lesson_empty: 'لا يوجد دروس بعد. أنشئ درساً من مصادر بياناتك!',
    lesson_generate: 'إنشاء درس',
    lesson_generating: 'جاري الإنشاء...',
    lesson_sections: 'الأقسام',
    lesson_concepts: 'المفاهيم الأساسية',
    lesson_vocabulary: 'المفردات',
    lesson_objectives: 'أهداف التعلم',

    // Tutor
    tutor_title: 'المعلّم الذكي',
    tutor_placeholder: 'اسألني عن أي شيء في الدرس...',
    tutor_listening: 'أستمع...',
    tutor_thinking: 'أفكر...',
    tutor_offline: 'خدمة الذكاء الاصطناعي غير متاحة. قم بتكوين GROQ_API_KEY أو GEMINI_API_KEY.',

    // Quiz
    quiz_title: 'اختبار',
    quiz_generate: 'إنشاء اختبار',
    quiz_question: 'سؤال',
    quiz_correct: 'صحيح!',
    quiz_wrong: 'خطأ!',
    quiz_score: 'النتيجة',
    quiz_next: 'السؤال التالي',

    // Podcast
    podcast_title: 'بودكاست شغوف',
    podcast_generate: 'إنشاء بودكاست',
    podcast_topic_placeholder: 'ادخل الموضوع...',
    podcast_play: 'تشغيل',
    podcast_stop: 'إيقاف',
    podcast_dialect: 'اللهجة المصرية',

    // Feynman
    feynman_title: 'تحدي فاينمان',
    feynman_topic_placeholder: 'الموضوع...',
    feynman_explanation_placeholder: 'اشرح ببساطة...',
    feynman_evaluate: 'قيّم شرحي',
    feynman_score: 'درجة البساطة',
    feynman_passed: 'اجتاز اختبار الجدة',
    feynman_failed: 'لم يجتز اختبار الجدة',
    feynman_has_analogy: 'يحتوي تشبيه',
    feynman_jargon: 'مصطلح تقني مكتشف',

    // Knowledge Graph
    graph_title: 'خريطة المعرفة',
    graph_level: 'المستوى',

    // Settings
    settings_title: 'الإعدادات',
    settings_language: 'اللغة',
    settings_theme: 'المظهر',
    settings_dark: 'داكن',
    settings_light: 'فاتح',
    settings_dialect: 'اللهجة المصرية',
    settings_profile: 'الملف الشخصي',

    // Accessibility
    access_title: 'إمكانية الوصول',
    access_dyslexia: 'خط عسر القراءة',
    access_focus: 'وضع التركيز',
    access_line_focus: 'تركيز السطر',

    // Chat
    chat_send: 'إرسال',
    chat_copy: 'نسخ',
    chat_listen: 'استمع',
    chat_stop: 'إيقاف',
    chat_hint: 'تلميح',
    chat_stuck: 'أنا عايز تلميح',
    chat_eli5: 'اشرح ببساطة',
    chat_deep: 'تعمق أكثر',

    // Wordwall
    wordwall_title: 'أنشطة Wordwall',
    wordwall_suggested: 'أنشطة مقترحة',
    wordwall_add_custom: 'إضافة نشاط Wordwall مخصص',
    wordwall_url_placeholder: 'الصق رابط Wordwall هنا...',
    wordwall_add: 'إضافة',
    wordwall_open: 'فتح في Wordwall',

    // Error
    error_title: 'حدث خطأ ما',
    error_reload: 'إعادة التحميل',
    error_clear_cache: 'مسح الكاش',
  },
}

/**
 * Get translation for a key in the current language.
 * @param {string} key - Translation key
 * @param {string} lang - Language code ('en' or 'ar')
 * @returns {string} Translated text
 */
export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations.en[key] || key
}

/**
 * Get all translations for a language.
 * @param {string} lang - Language code ('en' or 'ar')
 * @returns {object} Translation object
 */
export function getTranslations(lang = 'en') {
  return translations[lang] || translations.en
}

export default translations
