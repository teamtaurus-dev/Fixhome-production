import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, 
  Phone, 
  FileText, 
  Wrench, 
  PlusCircle, 
  Trash2, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  LogOut, 
  ShieldAlert, 
  RefreshCw,
  Image as ImageIcon
} from "lucide-react";
import { Category, Booking } from "../types.ts";

export default function AdminPortal() {
  // --- SESSION STATES ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [token, setToken] = useState<string>("");
  const [adminPhone, setAdminPhone] = useState<string>("");
  
  // Login Form Inputs
  const [loginPhone, setLoginPhone] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // --- DATA STATES ---
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [loadingCats, setLoadingCats] = useState<boolean>(false);
  
  // Create Category Inputs
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatDesc, setNewCatDesc] = useState<string>("");
  const [newCatImage, setNewCatImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [addingCat, setAddingCat] = useState<boolean>(false);
  
  // --- GUARDRAIL ALERTS ---
  const [coralAlert, setCoralAlert] = useState<string>(""); // Strict 30MB File constraint alert
  const [categorySuccess, setCategorySuccess] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");
  const [deleteSuccess, setDeleteSuccess] = useState<string>("");
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<{ success: boolean; message: string } | null>(null);

  // --- TIMEOUT CONTROLLER (15 Minutes Inactivity) ---
  const INACTIVITY_TIME = 15 * 60 * 1000; // 15 minutes
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveRef = useRef<number>(Date.now());

  // Check login on load
  useEffect(() => {
    const savedToken = sessionStorage.getItem("fix_home_admin_token");
    const savedPhone = sessionStorage.getItem("fix_home_admin_phone");
    if (savedToken && savedPhone) {
      setToken(savedToken);
      setAdminPhone(savedPhone);
      setIsLoggedIn(true);
    }
  }, []);

  // Sync state & register inactivity events once logged in
  useEffect(() => {
    if (!isLoggedIn) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    // Load dashboard data
    fetchBookings();
    fetchCategories();

    // Inactivity Reset Helper
    const resetIdleTimer = () => {
      lastActiveRef.current = Date.now();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        handleLogout("Session revoked due to 15 minutes of inactivity.");
      }, INACTIVITY_TIME);
    };

    // Listen to user inputs across the viewport
    const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetIdleTimer);
    });

    // Start initial timer
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [isLoggedIn]);

  // --- ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: loginPhone, password: loginPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToken(data.token);
        setAdminPhone(data.admin.mobile_number);
        sessionStorage.setItem("fix_home_admin_token", data.token);
        sessionStorage.setItem("fix_home_admin_phone", data.admin.mobile_number);
        setIsLoggedIn(true);
        setLoginPhone("");
        setLoginPassword("");
      } else {
        setLoginError(data.error || "Authentication failed.");
      }
    } catch (err) {
      setLoginError("Failed to authenticate with server backend.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = (message?: string) => {
    sessionStorage.removeItem("fix_home_admin_token");
    sessionStorage.removeItem("fix_home_admin_phone");
    setToken("");
    setAdminPhone("");
    setIsLoggedIn(false);
    if (message) {
      setLoginError(message);
    }
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoadingCats(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        // Optimistic local state update
        setBookings((prev) =>
          prev.map((b) => (b.request_id === bookingId ? { ...b, status: newStatus as any, updated_at: new Date().toISOString() } : b))
        );
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
      }
    } catch (err) {
      console.error("Error updating booking status:", err);
    }
  };

  // CATEGORY FILE PICKER CONTROLLER WITH 30MB IMAGE VALIDATION
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCoralAlert("");
    setCategorySuccess("");
    const file = e.target.files?.[0];
    if (!file) return;

    // CRITICAL 30MB LIMIT VALIDATION
    const THIRTY_MB = 30 * 1024 * 1024;
    if (file.size > THIRTY_MB) {
      // Throw Soft Coral Alert instantly and reset inputs
      setCoralAlert(
        "CRITICAL FILE CONSTRAINT EXCEEDED: The selected image file is " +
        (file.size / (1024 * 1024)).toFixed(2) +
        "MB. To prevent transport timeouts, uploads exceeding exactly 30MB are strictly blocked by system policy."
      );
      setNewCatImage(null);
      setImagePreview("");
      e.target.value = ""; // Clear file selector input
      return;
    }

    setNewCatImage(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoralAlert("");
    setCategorySuccess("");

    if (!newCatName.trim() || !newCatDesc.trim()) {
      setCoralAlert("Service Name and Description text are required.");
      return;
    }

    if (!newCatImage) {
      setCoralAlert("Please select a device gallery image for this service.");
      return;
    }

    setAddingCat(true);
    const formData = new FormData();
    formData.append("name", newCatName);
    formData.append("description", newCatDesc);
    formData.append("image", newCatImage);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCategorySuccess(`Service category "${newCatName}" added successfully.`);
        setNewCatName("");
        setNewCatDesc("");
        setNewCatImage(null);
        setImagePreview("");
        fetchCategories(); // Refresh active services
      } else {
        setCoralAlert(data.error || "Failed to create category on server.");
      }
    } catch (err) {
      setCoralAlert("Network failure during category upload process.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setCategories((prev) => prev.filter((cat) => cat.id !== catId));
        setDeleteSuccess("Service category deleted successfully from the customer portal.");
        setDeletingCatId(null);
      } else if (res.status === 401) {
        handleLogout("Session expired. Please log in again.");
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Failed to delete category on backend.");
        setDeletingCatId(null);
      }
    } catch (err) {
      console.error("Error deleting category:", err);
      setDeleteError("Network failure while deleting service category.");
      setDeletingCatId(null);
    }
  };

  // FORCE MANUAL PII PURGE DIAGNOSTIC FOR DEVELOPERS/TESTERS
  const triggerManualPurgeDiagnostic = async () => {
    setPurgeResult(null);
    try {
      const res = await fetch("/api/admin/purge-pii", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPurgeResult({
          success: true,
          message: `Diagnostic Scan Complete! Purged PII of ${data.purged_count} booking requests older than 6 hours.`
        });
        fetchBookings(); // Refresh list to see columns wiped
      } else {
        setPurgeResult({
          success: false,
          message: data.error || "Diagnostic purge failed."
        });
      }
    } catch (err) {
      setPurgeResult({
        success: false,
        message: "Error sending manual purge diagnostic command."
      });
    }
  };

  // --- RENDER PORTALS ---

  // LOGIN PAGE (SECURE GATEWAY)
  if (!isLoggedIn) {
    return (
      <div id="admin-login" className="flex-1 flex flex-col justify-center items-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-slate-900 text-[#e2f1e7] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={28} className="text-[#65a30d]" />
            </div>
            <h2 className="text-xl font-bold text-[#1e293b]">Admin Gateway Portal</h2>
            <p className="text-xs text-slate-400">Restricted zone. Administrative access token required.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Admin Mobile Number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder=""
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Security Password
              </label>
              <input
                type="password"
                required
                placeholder=""
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
            </div>

            {loginError && (
              <div className="p-3.5 bg-[#fff1f2] border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-[#65a30d] hover:bg-[#52840a] disabled:bg-slate-300 text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isLoggingIn ? "Authorizing..." : "Authenticate Admin"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">
              Authorized credentials locked to single hardcoded administrator.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN DASHBOARD
  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-bold font-mono">
            AD
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1e293b]">Admin Console</h2>
            <p className="text-[10px] text-[#65a30d] font-bold">● Connected: {adminPhone}</p>
          </div>
        </div>

        <button
          onClick={() => handleLogout()}
          className="p-2 bg-slate-50 hover:bg-[#fff1f2] text-slate-500 hover:text-red-600 rounded-xl transition-all border border-slate-200"
          title="Sign out of Admin Session"
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* INACTIVITY ALARM WATERMARK */}
        <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 flex items-center justify-between text-xs shadow-md border border-slate-800">
          <div className="flex items-center gap-2.5 text-left">
            <Clock size={16} className="text-[#65a30d] animate-pulse" />
            <div>
              <span className="font-semibold block text-white text-[11px]">Automatic Idle Sentry Guard</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Locks workspace after 15 min of stillness</span>
            </div>
          </div>
          <span className="bg-slate-800 text-[#e2f1e7] border border-slate-700 px-2.5 py-1 rounded-lg text-[9px] font-bold font-mono">
            ACTIVE
          </span>
        </div>

        {/* SECTION 1: BOOKING DISPATCH REQUESTS */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-sm font-bold text-[#1e293b] tracking-tight">Active Dispatches</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Chronological queue of requested fixes</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={triggerManualPurgeDiagnostic}
                className="px-2.5 py-1.5 bg-[#fff1f2] text-red-700 hover:bg-rose-100 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 border border-rose-200"
                title="Force clean expired details"
              >
                <ShieldAlert size={12} />
                <span>Force Purge PII</span>
              </button>

              <button
                onClick={fetchBookings}
                disabled={loadingBookings}
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1e293b]"
                title="Refresh dispatch data"
              >
                <RefreshCw size={12} className={loadingBookings ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {purgeResult && (
            <div className={`p-3 border rounded-xl text-[10px] font-semibold leading-normal flex items-start justify-between gap-2 ${
              purgeResult.success 
                ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                : "bg-[#fff1f2] border-rose-100 text-rose-700"
            }`}>
              <div className="flex items-start gap-2">
                {purgeResult.success ? (
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                )}
                <div>{purgeResult.message}</div>
              </div>
              <button 
                type="button" 
                onClick={() => setPurgeResult(null)} 
                className="text-slate-400 hover:text-slate-600 font-bold px-1"
              >
                ×
              </button>
            </div>
          )}

          {loadingBookings ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Loading active bookings...
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-dashed rounded-2xl text-slate-400 text-xs p-4">
              No booking dispatches logged yet.
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div 
                  key={booking.request_id}
                  className={`border rounded-2xl p-4 text-left transition-all relative ${
                    booking.is_personal_data_deleted 
                      ? "bg-slate-50 border-slate-200" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Service badge & Time info */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block bg-[#e2f1e7] text-[#65a30d] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                        {booking.service_type}
                      </span>
                      <div className="text-[9px] text-slate-400 font-mono mt-1">
                        Placed: {new Date(booking.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Status badge and single tap slider action */}
                    <div className="flex flex-col items-end gap-1">
                      <select
                        value={booking.status}
                        onChange={(e) => handleUpdateStatus(booking.request_id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md outline-hidden border ${
                          booking.status === "Pending" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                          booking.status === "Assigned" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          booking.status === "In Progress" ? "bg-purple-100 text-purple-800 border-purple-200" :
                          "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {/* PII DETAILS COMPLIANCE INTERFACE */}
                  {booking.is_personal_data_deleted ? (
                    <div className="mt-3.5 bg-[#fff1f2] border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-700">
                      <Clock size={14} className="shrink-0" />
                      <span className="text-[10px] font-bold tracking-tight">
                        [PII DELETED: 6-Hour Safety Retention Cleared]
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3.5 bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-slate-400" />
                        <span className="font-semibold text-slate-700 select-all">{booking.mobile_number}</span>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <FileText size={12} className="text-slate-400 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-700 select-all">{booking.address}</p>
                          {booking.landmark && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              Landmark: <span className="text-slate-600">{booking.landmark}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* GPS Overlay link */}
                      {(booking.latitude || booking.longitude) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1.5 border-t border-slate-200">
                          <MapPin size={10} className="text-rose-500" />
                          <span className="font-mono">
                            Coords: {booking.latitude?.toFixed(5)}, {booking.longitude?.toFixed(5)}
                          </span>
                        </div>
                      )}

                      {booking.additional_notes && (
                        <div className="bg-white p-2 border border-slate-200 rounded-lg text-[10px] text-slate-500 mt-1 leading-normal">
                          <span className="font-bold text-slate-600 block mb-0.5">Details:</span>
                          {booking.additional_notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operational uuid metric identifier */}
                  <div className="mt-2 text-right">
                    <span className="text-[8px] font-mono text-slate-300 font-bold uppercase select-all">
                      ID: {booking.request_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2: ADD SERVICE CATEGORY FORM */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="text-left">
            <h3 className="text-sm font-bold text-[#1e293b] tracking-tight">Add Service Category</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Introduces custom dispatches on customer interface</p>
          </div>

          <form onSubmit={handleAddCategorySubmit} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Service Name
              </label>
              <input
                type="text"
                required
                placeholder="E.g., Appliance Servicing"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Description Text
              </label>
              <textarea
                required
                rows={2}
                placeholder="Describe this category's scope..."
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-normal"
              />
            </div>

            {/* Simulated expo-image-picker file uploader */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Category Cover Image
              </label>
              <div className="mt-1 flex items-center gap-4">
                <label className="cursor-pointer bg-[#e2f1e7] hover:bg-emerald-100 text-[#65a30d] px-3 py-2 rounded-xl text-xs font-bold transition-all border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <PlusCircle size={14} />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {newCatImage ? newCatImage.name : "No image selected"}
                </span>
              </div>

              {/* Cover Preview */}
              {imagePreview && (
                <div className="mt-3 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* STRICT 30MB INTERCEPT SYSTEM ALERT */}
            {coralAlert && (
              <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-700 rounded-xl text-[10px] font-semibold leading-relaxed flex items-start gap-2 animate-pulse">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                <div>{coralAlert}</div>
              </div>
            )}

            {categorySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-semibold leading-normal flex items-start gap-2">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                <div>{categorySuccess}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={addingCat}
              className="w-full py-3 bg-[#1e293b] text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {addingCat ? "Uploading service cover..." : "Publish Service Category"}
            </button>
          </form>
        </div>

        {/* SECTION 3: MANAGE / DELETE CATEGORIES */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="text-left">
            <h3 className="text-sm font-bold text-[#1e293b]">Active Directories</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Delete categories to pull them out of customer client instantly</p>
          </div>

          {deleteError && (
            <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-700 rounded-xl text-[10px] font-semibold leading-relaxed flex items-start gap-2 animate-pulse">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
              <div>{deleteError}</div>
            </div>
          )}

          {deleteSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-semibold leading-normal flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
              <div>{deleteSuccess}</div>
            </div>
          )}

          {loadingCats ? (
            <div className="text-center text-slate-400 text-xs">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="text-center text-slate-400 text-xs">No active service categories.</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between gap-3 text-left"
                >
                  <img 
                    src={cat.image_url} 
                    alt={cat.name} 
                    className="w-10 h-10 rounded-lg object-cover border shrink-0 bg-slate-100" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#1e293b] truncate">{cat.name}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{cat.description}</p>
                  </div>
                  {deletingCatId === cat.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCatId(null)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingCatId(cat.id)}
                      className="p-2 bg-white text-rose-500 hover:bg-[#fff1f2] border rounded-lg transition-colors shadow-2xs shrink-0"
                      title="Delete service directory"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
