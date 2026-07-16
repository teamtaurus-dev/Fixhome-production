import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  MapPin, 
  Compass, 
  Wrench, 
  Phone, 
  FileText, 
  Building, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";
import { Category, Booking } from "../types.ts";
import PrivacyPolicy from "./PrivacyPolicy.tsx";

export default function CustomerPortal() {
  // --- STATE ---
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean | null>(null);
  const [viewingFullPrivacy, setViewingFullPrivacy] = useState<boolean>(false);
  const [gpsModalOpen, setGpsModalOpen] = useState<boolean>(false);
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState<boolean | null>(null);
  
  // Location States
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>("");

  // Categories & Selected Service State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState<boolean>(true);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);

  // Form Booking States
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [landmark, setLandmark] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Booking Success State
  const [submittedBooking, setSubmittedBooking] = useState<Booking | null>(null);

  // --- INITIAL LAUNCH CHECKS ---
  useEffect(() => {
    // Check local storage for privacy consent
    const accepted = localStorage.getItem("fix_home_privacy_accepted");
    setPrivacyAccepted(accepted === "true");

    // Fetch categories
    fetchCategories();
  }, []);

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

  // --- PRIVACY HANDLER ---
  const handleAcceptPrivacy = () => {
    localStorage.setItem("fix_home_privacy_accepted", "true");
    setPrivacyAccepted(true);
  };

  // --- GPS PERMISSION AND GEOLOCATION CORE ---
  const triggerGpsPrompt = () => {
    setGpsModalOpen(true);
  };

  const handleConfirmGpsPermission = () => {
    setGpsModalOpen(false);
    setLocating(true);
    setGpsStatusText("Requesting GPS hardware access...");

    if (!navigator.geolocation) {
      setGpsPermissionGranted(false);
      setGpsStatusText("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoords(newCoords);
        setGpsPermissionGranted(true);
        setGpsStatusText("Resolving exact address...");

        // Query OpenStreetMap Nominatim for clean physical address name
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}&zoom=18&addressdetails=1&email=teamtaurus2026@gmail.com`, {
          headers: { "Accept-Language": "en" }
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setAddress(data.display_name);
              setGpsStatusText("Exact address resolved successfully!");
            } else {
              setAddress(`Downtown Area (Lat: ${newCoords.lat.toFixed(4)}, Lng: ${newCoords.lng.toFixed(4)})`);
              setGpsStatusText("Pinpoint coordinates locked!");
            }
          })
          .catch((err) => {
            console.error("Reverse geocoding error:", err);
            setAddress(`Downtown Area (Lat: ${newCoords.lat.toFixed(4)}, Lng: ${newCoords.lng.toFixed(4)})`);
            setGpsStatusText("Coordinates locked! Fallback address generated.");
          })
          .finally(() => {
            setLocating(false);
          });
      },
      (error) => {
        console.error("GPS retrieval failed:", error);
        setGpsPermissionGranted(false);
        setLocating(false);
        
        let msg = "Location access denied. Please type your address manually.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "GPS access denied. Falling back to manual address entry.";
        }
        setGpsStatusText(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- SUBMIT BOOKING HANDLER ---
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedCat) {
      setFormError("Please select a repair service category first.");
      return;
    }

    if (!phone.trim()) {
      setFormError("A valid contact phone number is required.");
      return;
    }

    if (!address.trim()) {
      setFormError("An explicit physical address is required to dispatch agents.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        service_type: selectedCat.name,
        mobile_number: phone,
        address: address,
        latitude: coords ? coords.lat : null,
        longitude: coords ? coords.lng : null,
        landmark: landmark || undefined,
        additional_notes: notes || undefined
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmittedBooking(data.booking);
        // Clear forms
        setPhone("");
        setAddress("");
        setLandmark("");
        setNotes("");
        setCoords(null);
        setGpsPermissionGranted(null);
      } else {
        setFormError(data.error || "Failed to submit booking request. Please check your inputs.");
      }
    } catch (err) {
      setFormError("Network error. Please confirm your local connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- VIEW RENDER SEGMENTS ---

  // 1. PRIVACY POLICY GATE
  if (privacyAccepted === false) {
    return (
      <div id="privacy-gate" className="flex-1 flex flex-col justify-between bg-white px-6 py-6 h-[600px] overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-col items-center text-center pb-3 border-b border-slate-100 shrink-0">
            <div className="w-12 h-12 bg-[#e2f1e7] text-[#65a30d] rounded-xl flex items-center justify-center mb-2 shadow-xs border border-[#d1e7da]">
              <ShieldCheck size={28} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-bold text-[#1e293b] tracking-tight">Fix home Privacy Agreement</h2>
            <p className="text-xs text-slate-400 mt-0.5">Please read our privacy policy details below before utilizing the app</p>
          </div>
          
          {/* Scrollable Privacy Policy Section */}
          <div className="flex-1 overflow-y-auto my-4 border border-slate-200 rounded-2xl bg-slate-50/50">
            <PrivacyPolicy />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 w-full shrink-0">
          <button
            id="agree-continue-btn"
            onClick={handleAcceptPrivacy}
            className="w-full py-3 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl font-semibold shadow-md active:scale-[0.98] transition-all text-sm tracking-wide flex items-center justify-center gap-2"
          >
            Agree and Continue
          </button>
          
          {/* Required literal string */}
          <p className="text-[10px] text-slate-400 font-medium text-center px-4 leading-tight">
            By clicking agree and continue button you are accepting our privacy policies
          </p>
        </div>
      </div>
    );
  }

  // 1.5 VIEW FULL PRIVACY POLICY OVERLAY (ACCESSIBLE ANYTIME)
  if (viewingFullPrivacy) {
    return (
      <PrivacyPolicy 
        showBackHeader={true} 
        onBack={() => setViewingFullPrivacy(false)} 
      />
    );
  }

  // 2. BOOKING SUCCESSFUL SCREEN
  if (submittedBooking) {
    return (
      <div id="booking-success" className="flex-1 flex flex-col justify-between bg-white px-6 py-8">
        <div className="flex flex-col items-center mt-8 text-center">
          <div className="w-20 h-20 bg-[#e2f1e7] text-[#65a30d] rounded-full flex items-center justify-center mb-6 animate-bounce">
            <CheckCircle2 size={48} className="stroke-[2]" />
          </div>
          
          <span className="bg-[#e2f1e7] text-[#65a30d] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            Dispatched Successful
          </span>

          {/* REQUIRED EXACT UNALTERED TEXT */}
          <h2 className="text-xl font-bold text-[#1e293b] leading-tight px-4 mt-2">
            our agent will contact you in a while
          </h2>

          <p className="text-xs text-slate-500 mt-4 leading-relaxed max-w-[280px]">
            Your booking request has been securely logged on our local dispatcher dashboard.
          </p>

          {/* Booking Info Box */}
          <div className="w-full mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Request ID</span>
              <span className="text-xs font-mono font-bold text-slate-700 bg-white border px-1.5 py-0.5 rounded shadow-2xs truncate max-w-[170px]">
                {submittedBooking.request_id}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Service Type</span>
              <span className="text-xs font-semibold text-[#1e293b]">
                {submittedBooking.service_type}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</span>
              <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {submittedBooking.status}
              </span>
            </div>
          </div>

          {/* 6-Hour Data Retention Timer Warning */}
          <div className="mt-6 flex gap-3 p-3.5 bg-[#fff1f2] border border-rose-100 rounded-xl text-left">
            <Clock size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[#1e293b]">Automatic PII Purge Active</h4>
              <p className="text-[10px] text-slate-500 leading-normal">
                To guard your privacy, your phone number and physical address details will be permanently wiped from our database exactly <strong>6 hours</strong> from now.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setSubmittedBooking(null);
            setSelectedCat(null);
          }}
          className="w-full py-3.5 bg-[#1e293b] text-white rounded-xl font-semibold shadow-md text-xs tracking-wider uppercase active:scale-[0.98] transition-all"
        >
          Book Another Repair
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Sub-Header */}
      <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#1e293b] tracking-tight">Fix home Services</h1>
          <p className="text-[11px] text-slate-400 font-medium">Select a category below to book instantly</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e2f1e7] rounded-full border border-emerald-100">
          <Clock size={11} className="text-[#65a30d]" />
          <span className="text-[9px] font-bold text-[#65a30d] uppercase">6h Purge</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col space-y-6">
        {/* SECTION A: SERVICES DIRECTORY */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Service Categories
          </h3>

          {loadingCats ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse flex items-center px-4 gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-slate-200 rounded"></div>
                    <div className="h-2 w-2/3 bg-slate-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <Wrench size={24} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs text-slate-500">No active categories. Contact administrator.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const isSelected = selectedCat?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCat(cat);
                      setFormError("");
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex gap-4 items-center relative ${
                      isSelected 
                        ? "bg-[#e2f1e7] border-[#65a30d] shadow-xs" 
                        : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <img 
                      src={cat.image_url} 
                      alt={cat.name} 
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Fallback fallback
                        (e.target as any).src = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=200&auto=format&fit=crop";
                      }}
                    />
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-xs font-bold text-[#1e293b] truncate">{cat.name}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{cat.description}</p>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected 
                          ? "border-[#65a30d] bg-[#65a30d]" 
                          : "border-slate-300 bg-white"
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION B: GEOLOCATION MAP & FORM */}
        {selectedCat && (
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">
                Repair Request Dispatch Form
              </h3>
              <span className="text-[10px] bg-[#65a30d]/10 text-[#65a30d] px-2.5 py-0.5 rounded-full font-bold">
                {selectedCat.name}
              </span>
            </div>

            {/* GPS Map Controller Segment */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#e2f1e7] text-[#65a30d] rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={16} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h4 className="text-xs font-bold text-[#1e293b]">GPS Dispatch Overlay</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Locks satellite coordinates for precision arrival</p>
                </div>
                <button
                  type="button"
                  onClick={triggerGpsPrompt}
                  disabled={locating}
                  className="px-3 py-1.5 bg-[#65a30d] hover:bg-[#52840a] disabled:bg-slate-300 text-white text-[10px] font-bold rounded-lg transition-colors shadow-xs"
                >
                  {locating ? "Locating..." : "Locate Me"}
                </button>
              </div>

              {/* Status or Coordinate feedback */}
              {gpsStatusText && (
                <div className={`text-[10px] p-2.5 rounded-lg border flex gap-2 items-center ${
                  gpsPermissionGranted === false 
                    ? "bg-[#fff1f2] text-rose-600 border-rose-100" 
                    : "bg-[#e2f1e7] text-emerald-800 border-emerald-100"
                }`}>
                  <Info size={12} className="shrink-0" />
                  <span className="truncate font-semibold">{gpsStatusText}</span>
                </div>
              )}

              {/* Map Illustration / Visual Coordinates feedback */}
              <div className="relative h-28 bg-slate-200 rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden">
                {/* Simulated Street grid background */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                {/* Visual coordinate target */}
                {coords ? (
                  <div className="absolute flex flex-col items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute"></div>
                    <MapPin className="text-red-500 z-10 filter drop-shadow" size={24} />
                    <div className="bg-[#1e293b] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow mt-1">
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400 gap-1 p-4 text-center">
                    <Compass size={24} className="animate-spin-slow text-slate-300" />
                    <span className="text-[9px] font-medium leading-snug">
                      Tap "Locate Me" or type explicit address below to drop manual pin.
                    </span>
                  </div>
                )}
                
                {/* Map watermark branding logs */}
                <div className="absolute bottom-1 right-2 text-[8px] font-mono font-bold text-slate-400 pointer-events-none select-none">
                  com.fixhome.app MAPS
                </div>
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleBookingSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Customer Mobile Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="Enter contact number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Explicit Dispatch Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
                  <textarea
                    required
                    rows={2}
                    placeholder="Provide detailed physical address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-relaxed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Landmark <span className="text-slate-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="E.g., Near City Church"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Additional Notes / Defect Details <span className="text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide any additional notes or instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-relaxed"
                />
              </div>

              {formError && (
                <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#65a30d] hover:bg-[#52840a] disabled:bg-slate-300 text-white rounded-xl font-semibold shadow-md text-xs tracking-wider uppercase active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Dispatching Technician..." : `Submit ${selectedCat.name} Booking`}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer link to Privacy Policy */}
      <div className="py-3.5 px-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
        <span className="text-[10px] text-slate-400 font-mono">v4.0.0 • Fix home</span>
        <button
          type="button"
          onClick={() => setViewingFullPrivacy(true)}
          className="text-[10px] font-bold text-[#65a30d] hover:underline"
        >
          Privacy Policy
        </button>
      </div>

      {/* GPS Warning Pre-permission Info Dialog */}
      {gpsModalOpen && (
        <div className="absolute inset-0 bg-[#1e293b]/70 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 text-center space-y-4 max-w-[310px] shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-[#e2f1e7] text-[#65a30d] rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Compass size={24} className="animate-spin-slow stroke-[2]" />
            </div>
            
            <h3 className="text-base font-bold text-[#1e293b] tracking-tight">
              Pre-Permission Location Check
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-normal">
              <strong>Fix home</strong> requires your exact geolocation coordinates to pinpoint dispatch technicians.
            </p>
            <p className="text-[10px] text-slate-400 leading-normal bg-slate-50 p-2 rounded-lg border">
              We gather GPS coordinates <strong>solely in the foreground</strong> for dispatch accuracy. No background tracking is active.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setGpsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-[#1e293b] text-xs font-bold rounded-xl transition-all"
              >
                Type Manually
              </button>
              <button
                onClick={handleConfirmGpsPermission}
                className="flex-1 py-2 bg-[#65a30d] hover:bg-[#52840a] text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Allow GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
