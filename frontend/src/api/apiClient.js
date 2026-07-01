import axios from "axios";

/**
 * apiClient: مخصص للتعامل مع السيرفر الرئيسي (Auth / Database / Chat History).
 * baseURL: يتم جلبه من VITE_API_BASE_URL في ملف .env
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
   headers: {
    //  'Content-Type': 'application/json',
    // هذا السطر مهم جداً لتخطي صفحة تحذير ngrok التي تسبب الـ CORS error
    'ngrok-skip-browser-warning': 'any-value',
    "ngrok-skip-browser-warning": "69420", // 🔥 هذا السطر هو السحر اللي هيحل المشكلة
  }
});

// ✅ Interceptor: لإضافة توكين التحقق تلقائياً في كل طلب (Headers)
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- [1] دوال المصادقة (Authentication) ---
export const login = (credentials) => 
  apiClient.post("api/v1/Auth/login", credentials).then(res => res.data);

export const register = (userData) => 
  apiClient.post("api/v1/Auth/register", userData).then(res => res.data);


// --- [2] دوال إدارة المحادثات (Chat Management API) ---

/**
 * جلب جميع المحادثات الخاصة بالمستخدم الحالي لعرضها في الهيستوري (Sidebar).
 * Endpoint: GET api/v1/Chat/GetAllChats
 */
export const getAllChats = () => 
  apiClient.get("api/v1/Chat/GetAllChats").then(res => res.data);

/**
 * إنشاء محادثة جديدة (يتم مناداتها عند أول فحص أو عند الضغط على New Chat).
 * Endpoint: POST api/v1/Chat
 * Payload: { chatName: string }
 */
export const createChat = (chatName) => 
  apiClient.post("api/v1/Chat", { chatName }).then(res => res.data);

/**
 * جلب جميع الرسائل (Scan Sessions) الخاصة بمحادثة معينة عند الضغط عليها في الهيستوري.
 * Endpoint: GET api/v1/Chat/{chatId}
 */
export const getChatMessages = (chatId) => 
  apiClient.get(`api/v1/Chat/${chatId}`).then(res => res.data);

/**
 * تغيير اسم محادثة قديمة.
 * Endpoint: PUT api/v1/Chat/Rename
 * Payload: { chatId: number, chatName: string }
 */
export const renameChat = (chatId, chatName) => 
  apiClient.put("api/v1/Chat/Rename", { chatId, chatName }).then(res => res.data);

/**
 * حذف محادثة نهائياً مع المجلد الخاص بها من السيرفر.
 * Endpoint: DELETE api/v1/Chat/{chatId}
 */
export const deleteChat = (chatId) => 
  apiClient.delete(`api/v1/Chat/${chatId}`).then(res => res.data);


export default apiClient;