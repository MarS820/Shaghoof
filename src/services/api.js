const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function request(path, { method = 'GET', body, params, isFormData } = {}) {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  const options = { method, headers: {} }
  if (body !== undefined) {
    if (isFormData) {
      options.body = body
    } else {
      options.headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
  }
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

async function requestBlob(path, { method = 'GET', body, params } = {}) {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  const options = { method, headers: {} }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.blob()
}

export const api = {
  register: (data) => request('/api/v1/register', { method: 'POST', body: data }),
  login: async (data) => {
    const res = await request('/api/v1/auth/login', { method: 'POST', body: data })
    // Backend returns the bare profile — normalize to the { ok, profile }
    // shape the auth pages read, so both stores behave identically.
    if (res && (res.ok === undefined) && (res.user_id || res.id || res.email)) {
      return { ok: true, profile: res }
    }
    return res
  },
  emailAvailable: (email) => request('/api/v1/auth/email-available', { params: { email } }),
  submitVarkQuiz: (data) => request('/api/v1/quiz/submit', { method: 'POST', body: data }),
  getProfile: (userId) => request('/api/v1/profile', { params: { user_id: userId } }),
  updateProfile: (userId, data) => request(`/api/v1/profile`, { method: 'PUT', params: { user_id: userId }, body: data }),
  brainwheel: (userId) => request('/api/v1/profile/brainwheel', { params: { user_id: userId } }),
  dailyPlan: (userId, language) => request('/api/v1/plan/daily', { params: { user_id: userId, language } }),
  completeDailyPlanTask: (data) => request('/api/v1/plan/daily/complete', { method: 'POST', body: data }),
  generateQuestions: (data) => request('/api/v1/questions/generate', { method: 'POST', body: data }),
  translateText: (text, target_lang) => request('/api/v1/translate', { method: 'POST', body: { text, target_lang } }),
  translateBatch: (texts, target_lang) => request('/api/v1/translate/batch', { method: 'POST', body: { texts, target_lang } }),
  submitAssessment: (data) => request('/api/v1/assess/submit', { method: 'POST', body: data }),
  saveAssessmentSession: (data) => request('/api/v1/assess/session', { method: 'POST', body: data }),
  generateStretch: (data) => request('/api/v1/assess/stretch/generate', { method: 'POST', body: data }),
  submitStretch: (data) => request('/api/v1/assess/stretch', { method: 'POST', body: data }),
  zeigarnik: (data) => request('/api/v1/retention/zeigarnik', { method: 'POST', body: data }),
  endowedProgress: (userId, course) => request('/api/v1/retention/endowed-progress', { params: { user_id: userId, course } }),
  surprise: (data) => request('/api/v1/retention/surprise', { method: 'POST', body: data }),
  emotion: (data) => request('/api/v1/retention/emotion', { method: 'POST', body: data }),
  breakReminder: (data) => request('/api/v1/retention/break', { method: 'POST', body: data }),
  affirmations: (data) => request('/api/v1/retention/affirmations', { method: 'POST', body: data }),
  logoutHook: (data) => request('/api/v1/retention/logout-hook', { method: 'POST', body: data }),
  enrolledClasses: (userId) => request('/api/v1/student/enrolled-classes', { params: { user_id: userId } }),

  // Teacher API
  teacherRegister: (data) => request('/api/v1/teacher/register', { method: 'POST', body: data }),
  teacherLogin: (data) => request('/api/v1/teacher/login', { method: 'POST', body: data }),
  teacherClasses: (teacherId) => request('/api/v1/teacher/classes', { params: { teacher_id: teacherId } }),
  createTeacherClass: (teacherId, data) => request('/api/v1/teacher/classes', { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  teacherRoster: (teacherId, classId, filters = {}) => request('/api/v1/teacher/roster', { params: { teacher_id: teacherId, class_id: classId, ...filters } }),
  teacherDashboard: (teacherId, classId) => request('/api/v1/teacher/dashboard', { params: { teacher_id: teacherId, class_id: classId } }),
  teacherNotifications: (teacherId) => request('/api/v1/teacher/notifications', { params: { teacher_id: teacherId } }),
  markNotificationsRead: (teacherId, notificationId) => request('/api/v1/teacher/notifications/mark-read', { method: 'POST', params: { teacher_id: teacherId, notification_id: notificationId } }),
  classStudents: (teacherId, classId) => request(`/api/v1/teacher/classes/${classId}/students`, { params: { teacher_id: teacherId } }),
  createStudent: (teacherId, classId, data) => request(`/api/v1/teacher/classes/${classId}/students`, { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  updateEnrollment: (teacherId, classId, studentId, data) => request(`/api/v1/teacher/classes/${classId}/students/${studentId}/enrollment`, { method: 'PATCH', params: { teacher_id: teacherId }, body: data }),
  studentProfile: (teacherId, classId, studentId) => request(`/api/v1/teacher/classes/${classId}/student/${studentId}`, { params: { teacher_id: teacherId } }),
  studentAnalytics: (teacherId, classId, studentId) => request(`/api/v1/teacher/classes/${classId}/student/${studentId}/analytics`, { params: { teacher_id: teacherId } }),
  classAssessments: (teacherId, classId) => request(`/api/v1/teacher/classes/${classId}/assessments`, { params: { teacher_id: teacherId } }),
  createAssessment: (teacherId, classId, data) => request(`/api/v1/teacher/classes/${classId}/assessments`, { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  createSubmission: (teacherId, data) => request('/api/v1/teacher/submissions', { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  overrideGrade: (teacherId, data) => request('/api/v1/teacher/override', { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  classSubmissions: (teacherId, classId) => request('/api/v1/teacher/submissions', { params: { teacher_id: teacherId, class_id: classId } }),
  assessmentAnalytics: (teacherId, classId) => request('/api/v1/teacher/assessments/analytics', { params: { teacher_id: teacherId, class_id: classId } }),
  misconceptions: (teacherId, classId) => request('/api/v1/teacher/misconceptions', { params: { teacher_id: teacherId, class_id: classId } }),
  studentNotes: (teacherId, classId, studentId) => request(`/api/v1/teacher/classes/${classId}/student/${studentId}/notes`, { params: { teacher_id: teacherId } }),
  addStudentNote: (teacherId, classId, studentId, data) => request(`/api/v1/teacher/classes/${classId}/student/${studentId}/notes`, { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  deleteStudentNote: (teacherId, classId, studentId, noteId) => request(`/api/v1/teacher/classes/${classId}/student/${studentId}/notes/${noteId}`, { method: 'DELETE', params: { teacher_id: teacherId } }),
  interventionSuggestions: (teacherId, classId) => request('/api/v1/teacher/interventions/suggestions', { params: { teacher_id: teacherId, class_id: classId } }),
  interventions: (teacherId, classId) => request('/api/v1/teacher/interventions', { params: { teacher_id: teacherId, class_id: classId } }),
  createIntervention: (teacherId, data) => request('/api/v1/teacher/interventions', { method: 'POST', params: { teacher_id: teacherId }, body: data }),
  createFromSuggestion: (teacherId, classId, studentId) => request('/api/v1/teacher/interventions/from-suggestion', { method: 'POST', params: { teacher_id: teacherId, class_id: classId, student_id: studentId } }),
  updateIntervention: (teacherId, interventionId, data) => request(`/api/v1/teacher/interventions/${interventionId}`, { method: 'PATCH', params: { teacher_id: teacherId }, body: data }),
  teacherSettings: (teacherId) => request('/api/v1/teacher/settings', { params: { teacher_id: teacherId } }),
  updateTeacherSettings: (teacherId, data) => request('/api/v1/teacher/settings', { method: 'PUT', params: { teacher_id: teacherId }, body: data }),
  auditLog: (teacherId) => request('/api/v1/teacher/audit-log', { params: { teacher_id: teacherId } }),
  downloadProgressCsv: (teacherId, classId) => requestBlob('/api/v1/teacher/reports/progress.csv', { params: { teacher_id: teacherId, class_id: classId } }),
  downloadReviewPdf: (teacherId, classId) => requestBlob('/api/v1/teacher/reports/review.pdf', { params: { teacher_id: teacherId, class_id: classId } }),
  downloadClassSummaryPdf: (teacherId, classId) => requestBlob('/api/v1/teacher/reports/class-summary.pdf', { params: { teacher_id: teacherId, class_id: classId } }),

  // ── Tutor Chat ──
  tutorChat: (data) => request('/chat/tutor', { method: 'POST', body: data }),
  tutorChatRag: (data) => request('/chat/tutor/rag', { method: 'POST', body: data }),

  // ── Quiz Generation ──
  generateQuiz: (data) => request('/quiz/generate', { method: 'POST', body: data }),

  // ── Flashcards ──
  generateFlashcards: (data) => request('/flashcards/generate', { method: 'POST', body: data }),

  // ── Assignments ──
  generateAssignment: (data) => request('/assignments/generate', { method: 'POST', body: data }),

  // ── PDF Chat ──
  uploadPdf: (formData) => fetch(`${API_BASE}/pdf/upload`, { method: 'POST', body: formData }).then(r => { if (!r.ok) throw new Error(`Upload failed ${r.status}`); return r.json() }),
  pdfChat: (data) => request('/pdf/chat', { method: 'POST', body: data }),

  // ── Moodle ──
  moodleConnect: (data) => request('/moodle/connect', { method: 'POST', body: data }),
  moodleStatus: (userId) => request('/moodle/status', { params: { user_id: userId } }),
  moodleDisconnect: (userId) => request('/moodle/disconnect', { method: 'POST', params: { user_id: userId } }),
  moodleCourses: (userId) => request('/moodle/courses', { params: { user_id: userId } }),
  moodleActivateCourse: (courseId, userId) => request(`/moodle/courses/${courseId}/activate`, { method: 'POST', params: { user_id: userId } }),
  moodleRagQuery: (data) => request('/moodle/rag/query', { method: 'POST', body: data }),

  // ── Lessons ──
  createWebLesson: (data) => request('/lessons/web', { method: 'POST', body: data }),
  formatLesson: (data) => request('/lessons/format', { method: 'POST', body: data }),
  generateLessonFromUrl: (data) => request('/lessons/generate/url', { method: 'POST', body: data }),
  generateLessonFromPdf: (formData) => request('/lessons/generate/pdf', { method: 'POST', body: formData, isFormData: true }),
  generateLessonFromPdfSession: (data) => request('/lessons/generate/pdf-session', { method: 'POST', body: data }),
  generateLessonFromText: (data) => request('/lessons/generate/text', { method: 'POST', body: data }),
  generateLessonFromMoodle: (data) => request('/lessons/generate/moodle', { method: 'POST', body: data }),
  listLessons: (userId) => request('/lessons/list', { params: { user_id: userId } }),
  getLesson: (sessionId, userId) => request(`/lessons/detail/${sessionId}`, { params: { user_id: userId } }),
  getWordwallPack: (sessionId, userId, templateId) => request(`/lessons/wordwall/${sessionId}`, { params: { user_id: userId, ...(templateId ? { template_id: templateId } : {}) } }),

  // ── Video Lessons ──
  generateVideoLesson: (data) => request('/video/generate', { method: 'POST', body: data }),

  // ── Wordwall Embed ──
  fetchWordwallOembed: (url, templateId) => request('/api/v1/wordwall/oembed', { method: 'POST', body: { url, template_id: templateId } }),
  validateWordwallUrl: (url) => request('/api/v1/wordwall/validate', { method: 'POST', body: { url } }),
  suggestWordwallActivities: (topic, subject) => request('/api/v1/wordwall/suggest', { method: 'POST', body: { topic, subject } }),
  addWordwallToLesson: (data) => request('/api/v1/wordwall/add-to-lesson', { method: 'POST', body: data }),
  getWordwallResource: (resourceId) => request(`/api/v1/wordwall/resource/${resourceId}`),

  // ── Personalization ──
  trackEvent: (data) => request('/personalization/track', { method: 'POST', body: data }),
  activityFeed: (userId, limit = 8) => request('/personalization/feed', { params: { user_id: userId, limit } }),
  getInsights: (userId) => request('/personalization/insights', { params: { user_id: userId } }),
  getWeakTopics: (userId) => request('/personalization/weak-topics', { params: { user_id: userId } }),
  getStrongTopics: (userId) => request('/personalization/strong-topics', { params: { user_id: userId } }),
  getRecommendations: (userId) => request('/personalization/recommendations', { params: { user_id: userId } }),

  // ── Championship Suite (Podcast, TTS, Feynman, Knowledge Graph, RAG) ──
  generatePodcast: (data) => request('/championship/podcast/generate', { method: 'POST', body: data }),
  // TTS returns audio/mpeg bytes — must use blob transport, not res.json()
  synthesizeTTS: (data) => requestBlob('/championship/podcast/tts', { method: 'POST', body: data }),
  evaluateFeynman: (data) => request('/championship/feynman/evaluate', { method: 'POST', body: data }),
  getKnowledgeGraph: (courseId) => request('/championship/graph/concepts', { params: { course_id: courseId } }),
  getRagBenchmark: () => request('/championship/rag/benchmark'),
}

// Teacher auth surface — same transport, but explicitly bound to the teacher
// endpoints (SQL teacher store) so role-aware pages can't hit the student
// twin store by accident.
export const apiTeacher = {
  register: api.teacherRegister,
  login: api.teacherLogin,
}

export default api
