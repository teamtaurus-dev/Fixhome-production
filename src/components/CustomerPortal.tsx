import React, { useState, useEffect, useRef } from "react";
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
  ChevronRight,
  Info,
  RefreshCw,
  UserCheck,
  Activity,
  Check,
  ArrowLeft,
  Radio,
  User,
  History,
  Tag,
  Ticket,
  Sparkles,
  Gift,
  X,
  LogOut,
  Languages,
  Copy,
  MessageSquare,
  Award,
  Lock,
  Eye,
  EyeOff,
  Key,
  Pencil,
  Plus,
  BellRing
} from "lucide-react";
import { Category, Booking, Offer } from "../types.ts";
import { 
  subscribeCategoriesRealtime, 
  subscribeOffersRealtime, 
  subscribeGlobalSignalRealtime, 
  subscribeBookingRealtime, 
  syncBookingToFirestore,
  fetchUserBookingsFromFirestore
} from "../lib/firebaseSync.ts";
import PrivacyPolicy from "./PrivacyPolicy.tsx";
import Skeleton from "./Skeleton.tsx";
import LanguageSelector from "./LanguageSelector.tsx";
import { Language, t } from "../i18n.ts";
import { FIXHOME_LOGO } from "../assets/logoData.ts";
import { logNav } from "../utils/navLogger.ts";
import { notifyNativeBackState, dialNativePhoneNumber } from "../utils/nativeBridge.ts";
import { isValidName, sanitizeNameInput, isValidPhoneNumber, sanitizeBookingPayload } from "../utils/validation.ts";
import { secureStorage } from "../utils/secureStorage.ts";
import { SubCategoryItem, parseSubcategoryItem, formatSubcategoryDisplay } from "../utils/categoryUtils.ts";
import { sendFCMPushNotification } from "../lib/notifications.ts";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.ts";

function safeText(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object") {
    if (val.type === "Buffer" && Array.isArray(val.data)) {
      try {
        return String.fromCharCode(...val.data);
      } catch (e) {
        return "";
      }
    }
    return JSON.stringify(val);
  }
  return String(val);
}

interface CustomerPortalProps {
  key?: React.Key;
  onTrackerStateChange?: (isTracking: boolean) => void;
  currentLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
  onLogout?: () => void;
}

function getLocalizedCategoryNameByString(catName: string, lang: Language): string {
  if (lang !== "te" || !catName) return catName;
  const nameLower = (catName || "").toLowerCase().trim();
  if (nameLower.includes("sewage") || nameLower.includes("drainage")) return "సీవేజ్ & డ్రైనేజీ సేవలు";
  if (nameLower.includes("shifting") || nameLower.includes("house shift") || nameLower.includes("relocation")) return "ఇల్లు మారే (హౌస్ షిఫ్టింగ్) సేవలు";
  if (nameLower.includes("plumb")) return "ప్లంబింగ్ రిపేర్ & ఇన్స్టాలేషన్";
  if (nameLower.includes("electr")) return "ఎలక్ట్రికల్ సేవలు & వైరింగ్";
  if (nameLower.includes("appliance") || nameLower.includes("air condition") || nameLower === "ac" || nameLower.startsWith("ac ") || nameLower.endsWith(" ac")) return "ఏసీ & గృహ ఉపకరణాల సేవలు";
  if (nameLower.includes("carpent")) return "కార్పెంటరీ & ఫర్నిచర్ పనులు";
  if (nameLower.includes("paint")) return "పెయింటింగ్ & వాటర్‌ప్రూఫింగ్";
  if (nameLower.includes("total home clean") || nameLower.includes("home clean") || nameLower.includes("clean")) return "డీప్ క్లీనింగ్ & శానిటైజేషన్";
  if (nameLower.includes("event")) return "ఈవెంట్ మేనేజ్‌మెంట్ సేవలు";
  if (nameLower.includes("handyman")) return "హ్యాండీమ్యాన్ సేవలు";
  if (nameLower.includes("pest")) return "పెస్ట్ కంట్రోల్ సేవలు";
  if (nameLower.includes("cctv") || nameLower.includes("security")) return "సిసిటివి & సెక్యూరిటీ సేవలు";
  return catName;
}

function getLocalizedCategoryName(cat: Category, lang: Language): string {
  if (lang === "te") {
    if (cat.id === "cat_1") return "ప్లంబింగ్ రిపేర్ & ఇన్స్టాలేషన్";
    if (cat.id === "cat_2") return "ఎలక్ట్రికల్ సేవలు & వైరింగ్";
    if (cat.id === "cat_3") return "ఏసీ & గృహ ఉపకరణాల సేవలు";
    if (cat.id === "cat_4") return "కార్పెంటరీ & ఫర్నిచర్ పనులు";
    if (cat.id === "cat_5") return "పెయింటింగ్ & వాటర్‌ప్రూఫింగ్";
    if (cat.id === "cat_6") return "డీప్ క్లీనింగ్ & శానిటైజేషన్";
    return getLocalizedCategoryNameByString(cat.name, lang);
  }
  return cat.name;
}

function getLocalizedCategoryDesc(cat: Category, lang: Language): string {
  if (lang === "te") {
    const nameLower = (cat.name || "").toLowerCase();
    const descLower = (cat.description || "").toLowerCase();
    if (cat.id === "cat_1" || nameLower.includes("plumb") || descLower.includes("plumb") || descLower.includes("tap")) return "టాప్ లీకేజీ, పైప్ ఫిట్టింగ్స్, బ్లాకేజ్ తొలగింపు, టాయిలెట్ & బేసిన్ రిపేర్";
    if (cat.id === "cat_2" || nameLower.includes("electr") || descLower.includes("electr") || descLower.includes("switch")) return "షార్ట్ సర్క్యూట్ బాగు చేయడం, స్విచ్ బోర్డులు, MCB మార్పిడి, ఫ్యాన్ & లైట్ ఫిట్టింగ్";
    if (cat.id === "cat_3" || nameLower.includes("appliance") || nameLower.includes("ac") || nameLower.includes("air condition") || descLower.includes("ac") || descLower.includes("cooling")) return "ఏసీ కూలింగ్ రిపేర్, గ్యాస్ ఛార్జింగ్, వాషింగ్ మెషిన్, ఫ్రిజ్ & గీజర్ సర్వీస్";
    if (cat.id === "cat_4" || nameLower.includes("carpent") || descLower.includes("carpent") || descLower.includes("door")) return "డోర్ లాక్ బాగు చేయడం, క్యాబినెట్ రిపేర్లు, బెడ్ అసెంబ్లీ, చెక్క ఫర్నిచర్ పనులు";
    if (cat.id === "cat_5" || nameLower.includes("paint") || descLower.includes("paint") || descLower.includes("wall")) return "గోడల పెయింటింగ్, వాటర్‌ప్రూఫ్ ప్యాచింగ్, ఎనామిల్ కోటింగ్, ఇంటీరియర్ టచ్‌అప్‌లు";
    if (cat.id === "cat_6" || nameLower.includes("clean") || descLower.includes("clean")) return "డీప్ బాత్‌రూమ్ క్లీనింగ్, కిచెన్ గ్రీస్ తొలగింపు, సోఫా & కార్పెట్ క్లీనింగ్";
    if (nameLower.includes("sewage") || descLower.includes("sewage") || nameLower.includes("drain") || descLower.includes("drain")) return "పైప్ బ్లాకేజ్ తొలగింపు, డ్రెయిన్ క్లీనింగ్ మరియు సీవేజ్ క్లియరెన్స్ సేవలు";
    if (nameLower.includes("event") || descLower.includes("event")) return "వివాహాలు, పుట్టినరోజులు మరియు ప్రత్యేక వేడుకల కోసం ఈవెంట్ మేనేజ్‌మెంట్";
    if (nameLower.includes("shifting") || descLower.includes("shifting")) return "స్థానిక మరియు సుదూర ప్రాంతాలకు ఇల్లు మారే (షిఫ్టింగ్) ప్రొఫెషనల్ సేవలు";
    if (nameLower.includes("handyman") || descLower.includes("handyman")) return "ఇంటి మరమ్మతులు, కర్టెన్ రాడ్లు, టీవీ ఫిట్టింగ్ మరియు సాధారణ పనుల నిపుణులు";
    if (nameLower.includes("pest") || descLower.includes("pest")) return "బొద్దింకలు, చెదపురుగులు మరియు కీటకాల నివారణ సేవలు";
    if (nameLower.includes("cctv") || descLower.includes("cctv") || nameLower.includes("security")) return "CCTV కెమెరా ఇన్‌స్టాలేషన్, DVR సెటప్ మరియు సెక్యూరిటీ మెయింటెనెన్స్";
  }
  return cat.description;
}

function getLocalizedSubcategoryName(rawName: string, lang: Language): string {
  if (lang !== "te" || !rawName) return rawName;
  const n = rawName.toLowerCase().trim();

  // --- Plumbing Subcategories & Tasks ---
  if (n.includes("flush tank") || n.includes("flush repair")) return "ఫ్లష్ ట్యాంక్ రిపేర్";
  if (n.includes("leakage repair") || n.includes("leak repair") || n.includes("leakage")) return "లీకేజ్ రిపేర్";
  if (n.includes("pipe line") || n.includes("pipeline") || n.includes("pipe fitting") || n.includes("pipe replacement") || n.includes("pipe repair")) return "పైప్‌లైన్ రిపేర్ & ఫిట్టింగ్";
  if (n.includes("water tank cleaning") || n.includes("tank cleaning")) return "వాటర్ ట్యాంక్ క్లీనింగ్";
  if (n.includes("bore motor") || n.includes("submersible motor") || n.includes("borewell")) return "బోర్ మోటార్ రిమూవల్ & ఫిక్సింగ్";
  if (n.includes("motor installation") || n.includes("water motor") || n.includes("motor repair") || n.includes("motor fix")) return "మోటార్ ఇన్‌స్టాలేషన్";
  if (n.includes("drain block") || n.includes("drainage block") || n.includes("blockage removal") || n.includes("drainage")) return "డ్రైన్ బ్లాకేజ్ తొలగింపు";
  if (n.includes("water heater") || n.includes("geyser connection")) return "వాటర్ హీటర్ కనెక్షన్";
  if (n.includes("shower installation") || n.includes("shower repair") || n.includes("shower")) return "షవర్ ఇన్‌స్టాలేషన్";
  if (n.includes("complete bathroom") || n.includes("bathroom plumbing")) return "పూర్తి బాత్‌రూమ్ ప్లంబింగ్ పనులు";
  if (n.includes("tap / faucet") || n.includes("tap/faucet") || n.includes("tap leakage") || n.includes("faucet") || n.includes("tap repair") || n.includes("tap")) return "టాప్/ఫాసెట్ ఇన్‌స్టాలేషన్";
  if (n.includes("wash basin") || n.includes("washbasin")) return "వాష్ బేసిన్ ఇన్‌స్టాలేషన్";
  if (n.includes("sink installation") || n.includes("sink fix") || n.includes("sink")) return "సింక్ ఇన్‌స్టాలేషన్";
  if (n.includes("toilet basin") || n.includes("toilet & washbasin") || n.includes("toilet fix") || n.includes("toilet installation") || n.includes("toilet repair") || n.includes("toilet")) return "టాయిలెట్ ఇన్‌స్టాలేషన్ & రిపేర్";

  // --- Cleaning Subcategories & Tasks ---
  if (n.includes("bathroom deep") || n.includes("bathroom clean")) return "బాత్‌రూమ్ డీప్ క్లీనింగ్";
  if (n.includes("kitchen degreasing") || n.includes("kitchen deep") || n.includes("kitchen clean")) return "కిచెన్ డీప్ క్లీనింగ్";
  if (n.includes("sofa") || n.includes("mattress") || n.includes("carpet")) return "సోఫా & మ్యాట్రెస్ క్లీనింగ్";
  if (n.includes("full home deep") || n.includes("full house clean") || n.includes("sanitization")) return "పూర్తి ఇంటి క్లీనింగ్ & శానిటైజేషన్";
  if (n.includes("balcony cleaning") || n.includes("floor scrubbing")) return "బాల్కనీ & ఫ్లోర్ స్క్రబ్బింగ్";
  if (n.includes("window cleaning") || n.includes("glass cleaning")) return "విండో & గ్లాస్ క్లీనింగ్";

  // --- AC & Appliances Subcategories & Tasks ---
  if (n.includes("ac general") || n.includes("ac service") || n.includes("ac deep clean")) return "ఏసీ జనరల్ సర్వీస్";
  if (n.includes("ac gas") || n.includes("gas charging") || n.includes("gas leak")) return "ఏసీ గ్యాస్ ఛార్జింగ్";
  if (n.includes("ac uninstallation") || n.includes("ac uninstall")) return "ఏసీ అన్‌ఇన్‌స్టాలేషన్";
  if (n.includes("ac installation") || n.includes("ac install")) return "ఏసీ ఇన్‌స్టాలేషన్";
  if (n.includes("washing machine")) return "వాషింగ్ మెషిన్ రిపేర్ & సర్వీస్";
  if (n.includes("refrigerator") || n.includes("fridge")) return "ఫ్రిజ్ రిపేర్ విజిట్";
  if (n.includes("geyser repair") || n.includes("geyser service") || n.includes("geyser")) return "గీజర్ రిపేర్ & సర్వీస్";
  if (n.includes("microwave") || n.includes("oven")) return "మైక్రోవేవ్ ఒవెన్ రిపేర్";
  if (n.includes("ro candle") || n.includes("candle changing")) return "RO క్యాండిల్ మార్పిడి";
  if (n.includes("water purifier") || n.includes("ro repair") || n.includes("ro service")) return "వాటర్ ప్యూరిఫైయర్ (RO) సర్వీస్";
  if (n.includes("cooler")) return "కూలర్ రిపేర్ సర్వీస్";

  // --- Carpentry & Furniture Subcategories & Tasks ---
  if (n.includes("door lock") || n.includes("latch repair") || n.includes("latch")) return "డోర్ లాక్ & లాచ్ రిపేర్";
  if (n.includes("door installation") || n.includes("door install")) return "డోర్ ఇన్‌స్టాలేషన్";
  if (n.includes("door alignment") || n.includes("door shaving") || n.includes("door repair")) return "డోర్ అలైన్‌మెంట్ / రిపేర్";
  if (n.includes("window repair") || n.includes("window fix")) return "విండో రిపేర్ & ఫిట్టింగ్";
  if (n.includes("cabinet") || n.includes("drawer") || n.includes("hinge")) return "క్యాబినెట్ & డ్రాయర్ హింజ్ రిపేర్";
  if (n.includes("wardrobe") || n.includes("cupboard")) return "వార్డ్‌రోబ్ / అల్మారా రిపేర్";
  if (n.includes("modular kitchen")) return "మాడ్యులర్ కిచెన్ రిపేర్";
  if (n.includes("cot assembly") || n.includes("cot")) return "మంచం (కాట్) అసెంబ్లీ";
  if (n.includes("dining table") || n.includes("table repair")) return "డైనింగ్ టేబుల్ రిపేర్";
  if (n.includes("bed") || n.includes("furniture assembly")) return "బెడ్ & ఫర్నిచర్ అసెంబ్లీ";
  if (n.includes("furniture shifting") || n.includes("shifting")) return "ఫర్నిచర్ షిఫ్టింగ్ & తరలింపు";
  if (n.includes("wooden door") || n.includes("wood work")) return "చెక్క డోర్ ఫిట్టింగ్ పనులు";
  if (n.includes("wooden shelf") || n.includes("shelf") || n.includes("rack")) return "వుడెన్ షెల్ఫ్ & ర్యాక్ ఫిట్టింగ్";
  if (n.includes("complete carpenter") || n.includes("carpenter visit")) return "పూర్తి కార్పెంటర్ విజిట్ & తనిఖీ";
  if (n.includes("mesh door") || n.includes("mosquito mesh")) return "దోమల మెష్ & నెట్ ఫిట్టింగ్";

  // --- Painting & Waterproofing Subcategories & Tasks ---
  if (n.includes("wall patch") || n.includes("wall putty") || n.includes("putty")) return "వాల్ పుట్టీ అప్లికేషన్";
  if (n.includes("texture painting") || n.includes("texture")) return "టెక్స్చర్ పెయింటింగ్ డిజైన్";
  if (n.includes("primer")) return "ప్రైమర్ అప్లికేషన్";
  if (n.includes("door painting")) return "డోర్ పెయింటింగ్";
  if (n.includes("window painting")) return "విండో పెయింటింగ్";
  if (n.includes("grill painting") || n.includes("grill")) return "గ్రిల్ పెయింటింగ్";
  if (n.includes("waterproof") || n.includes("waterproofing")) return "వాటర్‌ప్రూఫ్ కోటింగ్";
  if (n.includes("metal enamel") || n.includes("enamel")) return "మెటల్ ఎనామిల్ పెయింటింగ్";
  if (n.includes("wood polish") || n.includes("varnish")) return "వుడ్ పాలిష్ వర్క్";
  if (n.includes("wood painting") || n.includes("wood paint")) return "వుడ్ పెయింటింగ్";
  if (n.includes("single room") || n.includes("interior emulsion") || n.includes("interior painting") || n.includes("interior wall")) return "ఇంటీరియర్ ఎమల్షన్ పెయింటింగ్";
  if (n.includes("interior wall touchup") || n.includes("wall touchup") || n.includes("touchup")) return "ఇంటీరియర్ వాల్ టచ్‌అప్‌లు";
  if (n.includes("exterior painting") || n.includes("exterior paint") || n.includes("outer wall")) return "ఎక్స్‌టీరియర్ పెయింటింగ్";
  if (n.includes("paint inspection") || n.includes("house paint") || n.includes("full house paint")) return "ఇంటి పెయింట్ తనిఖీ సేవ";

  // --- Electrical Subcategories & Tasks ---
  if (n.includes("switch replacement") || n.includes("switchboard") || n.includes("switch")) return "స్విచ్ మార్పిడి & రిపేర్";
  if (n.includes("socket installation") || n.includes("socket")) return "సాకెట్ ఇన్‌స్టాలేషన్";
  if (n.includes("tube light")) return "ట్యూబ్‌లైట్ ఇన్‌స్టాలేషన్";
  if (n.includes("led") || n.includes("led light")) return "LED లైట్ ఇన్‌స్టాలేషన్";
  if (n.includes("chandelier") || n.includes("light fitting")) return "షాన్డిలియర్ & లైటింగ్ ఫిట్టింగ్";
  if (n.includes("ceiling fan repair") || n.includes("fan repair")) return "సీలింగ్ ఫ్యాన్ రిపేర్";
  if (n.includes("fan installation") || n.includes("ceiling fan") || n.includes("fan mounting") || n.includes("fan")) return "సీలింగ్ ఫ్యాన్ ఇన్‌స్టాలేషన్";
  if (n.includes("mcb") || n.includes("fuse") || n.includes("short circuit") || n.includes("tripping")) return "MCB & ఫ్యూజ్ మార్పిడి";
  if (n.includes("distribution board") || n.includes("db service")) return "డిస్ట్రిబ్యూషన్ బోర్డ్ (DB) సర్వీస్";
  if (n.includes("new wiring")) return "కొత్త వైరింగ్ ఇన్‌స్టాలేషన్";
  if (n.includes("wiring repair") || n.includes("wiring")) return "వైరింగ్ రిపేర్ & కేబులింగ్";
  if (n.includes("inverter installation")) return "ఇన్వర్టర్ ఇన్‌స్టాలేషన్";
  if (n.includes("inverter checking") || n.includes("inverter")) return "ఇన్వర్టర్ తనిఖీ & సర్వీస్";
  if (n.includes("earthing")) return "ఎర్తింగ్ వర్క్ & సేఫ్టీ";
  if (n.includes("electrical inspection") || n.includes("home electrical")) return "పూర్తి ఇంటి ఎలక్ట్రికల్ తనిఖీ";

  // --- Handyman & Misc Subcategories & Tasks ---
  if (n.includes("curtain rod") || n.includes("curtain pipe") || n.includes("curtain")) return "కర్టెన్ రాడ్ ఇన్‌స్టాలేషన్";
  if (n.includes("tv wall") || n.includes("tv mounting") || n.includes("tv installation") || n.includes("television")) return "టీవీ వాల్ మౌంటింగ్ & ఇన్‌స్టాలేషన్";
  if (n.includes("picture frame") || n.includes("photo frame")) return "పిక్చర్ / ఫోటో ఫ్రేమ్ ఫిక్సింగ్";
  if (n.includes("mirror installation") || n.includes("mirror mounting") || n.includes("mirror")) return "మిర్రర్ ఇన్‌స్టాలేషన్";
  if (n.includes("shelf") || n.includes("wall shelf") || n.includes("rack")) return "వాల్ షెల్ఫ్ & ర్యాక్ ఫిట్టింగ్";
  if (n.includes("drilling") || n.includes("hanging")) return "వాల్ డ్రిల్లింగ్ & హ్యాంగింగ్ పనులు";
  if (n.includes("general repair") || n.includes("inspection") || n.includes("visiting")) return "జనరల్ రిపేర్లు / విజిటింగ్ తనిఖీ";

  // --- CCTV & Security ---
  if (n.includes("cctv camera") || n.includes("cctv installation") || n.includes("camera fixing")) return "CCTV కెమెరా ఇన్‌స్టాలేషన్";
  if (n.includes("dvr") || n.includes("nvr") || n.includes("security camera repair")) return "CCTV & DVR రిపేర్ సర్వీస్";

  // --- Pest Control ---
  if (n.includes("cockroach") || n.includes("general pest")) return "బొద్దింకలు & జనరల్ పెస్ట్ కంట్రోల్";
  if (n.includes("termite") || n.includes("anti termite")) return "చెదపురుగుల నివారణ (టెర్మైట్ ట్రీట్మెంట్)";
  if (n.includes("bed bug") || n.includes("bedbug")) return "నల్లుల నివారణ (బెడ్‌బగ్ కంట్రోల్)";

  return rawName;
}

function getLocalizedServiceType(rawServiceType: string | undefined | null, lang: Language): string {
  if (!rawServiceType) return "";
  if (lang !== "te") return rawServiceType;

  // Handle multi-service compounds separated by "+"
  if (rawServiceType.includes("+")) {
    return rawServiceType
      .split("+")
      .map((p) => getLocalizedServiceType(p.trim(), lang))
      .join(" + ");
  }

  // Handle category with subcategory list like "Plumbing services: Tap Leakage, Pipe Repair"
  if (rawServiceType.includes(":")) {
    const colonIdx = rawServiceType.indexOf(":");
    const catPart = rawServiceType.substring(0, colonIdx).trim();
    const restPart = rawServiceType.substring(colonIdx + 1).trim();
    const locCat = getLocalizedCategoryNameByString(catPart, lang);
    const locRest = restPart
      .split(",")
      .map((sub) => {
        const sTrim = sub.trim();
        const cleanSub = sTrim.replace(/\s*-\s*₹.*$/, "").replace(/\s*\(.*?\)$/, "").trim();
        return getLocalizedSubcategoryName(cleanSub, lang);
      })
      .join(", ");
    return `${locCat}: ${locRest}`;
  }

  // Check category match first
  const locCat = getLocalizedCategoryNameByString(rawServiceType, lang);
  if (locCat !== rawServiceType) return locCat;

  // Check subcategory match
  const cleanSub = rawServiceType.replace(/\s*-\s*₹.*$/, "").replace(/\s*\(.*?\)$/, "").trim();
  const locSub = getLocalizedSubcategoryName(cleanSub, lang);
  if (locSub !== cleanSub) return locSub;

  return rawServiceType;
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat_1",
    name: "Plumbing Repair & Installation",
    description: "Tap leakage, pipe fittings, blockage removal, toilet & basin repair",
    image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "Tap Leakage & Repair - ₹199 - ₹299",
      "Pipe Fitting & Replacement - ₹349 - ₹549",
      "Blockage Removal & Drainage - ₹299 - ₹499",
      "Toilet & Washbasin Fix - ₹399 - ₹599"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cat_2",
    name: "Electrical Repairs & Wiring",
    description: "Short circuit fixing, switchboards, MCB replacement, fan & light installation",
    image_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "Switchboard & Socket Fix - ₹149 - ₹249",
      "Ceiling Fan Repair & Mounting - ₹249 - ₹399",
      "MCB & Fuse Replacement - ₹299 - ₹499",
      "Light Fitting & Chandelier Work - ₹199 - ₹349"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cat_3",
    name: "AC & Appliance Service",
    description: "AC cooling repair, gas charging, washing machine, fridge & geyser service",
    image_url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "AC General Deep Cleaning - ₹499 - ₹799",
      "AC Gas Charging & Leak Check - ₹1499 - ₹1999",
      "Washing Machine Repair - ₹399 - ₹699",
      "Geyser Repair & De-scaling - ₹449 - ₹749"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cat_4",
    name: "Carpentry & Furniture Fixes",
    description: "Door lock fixing, cabinet repairs, bed assembly, wooden furniture work",
    image_url: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "Door Lock & Latch Repair - ₹199 - ₹299",
      "Cabinet & Drawer Hinge Fix - ₹299 - ₹449",
      "Bed & Furniture Assembly - ₹399 - ₹699",
      "Wooden Door Fitting & Shaving - ₹349 - ₹549"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cat_5",
    name: "House Painting & Touchups",
    description: "Wall painting, waterproof patching, enamel coating, interior touchups",
    image_url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "Wall Patchwork & Waterproofing - ₹599 - ₹999",
      "Single Room Painting - ₹1499 - ₹2499",
      "Interior Wall Touchups - ₹899 - ₹1399",
      "Full House Paint Inspection Visit - ₹199 - ₹399"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cat_6",
    name: "Home Cleaning & Sanitization",
    description: "Deep bathroom cleaning, kitchen degreasing, sofa & carpet shampooing",
    image_url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=400&auto=format&fit=crop",
    subcategories: [
      "Bathroom Deep Cleaning - ₹399 - ₹699",
      "Kitchen Degreasing & Wash - ₹699 - ₹1099",
      "Sofa & Mattress Shampooing - ₹599 - ₹999",
      "Full Home Deep Sanitization - ₹1999 - ₹2999"
    ],
    created_at: "2026-01-01T00:00:00.000Z"
  }
];

export default function CustomerPortal({
  onTrackerStateChange,
  currentLanguage = "en",
  onLanguageChange = () => {},
  onLogout,
}: CustomerPortalProps) {
  const isTe = currentLanguage === "te";
  // --- STATE ---
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("fix_home_privacy_accepted");
      if (saved !== null) return saved === "true";
    } catch (e) {}
    return true;
  });
  const [viewingFullPrivacy, setViewingFullPrivacy] = useState<boolean>(false);
  const [gpsModalOpen, setGpsModalOpen] = useState<boolean>(false);
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState<boolean | null>(null);
  
  // Mobile Login & History States
  const [userMobile, setUserMobile] = useState<string>(() => localStorage.getItem("fix_home_user_mobile") || "");
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [userHistory, setUserHistory] = useState<Booking[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Offers State
  const [offers, setOffers] = useState<Offer[]>(() => {
    try {
      const saved = localStorage.getItem("fix_home_cached_offers");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [loadingOffers, setLoadingOffers] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("fix_home_cached_offers");
      if (saved && JSON.parse(saved).length > 0) return false;
    } catch (e) {}
    return true;
  });

  // Dismissed Offer / Coupon Cards State
  const [dismissedCoupons, setDismissedCoupons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("fix_home_dismissed_coupons");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const handleDismissCoupon = (codeOrId: string) => {
    setDismissedCoupons((prev) => {
      const updated = [...prev, codeOrId];
      try {
        localStorage.setItem("fix_home_dismissed_coupons", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Location States
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Categories & Selected Services State
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem("fix_home_cached_categories");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [loadingCats, setLoadingCats] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("fix_home_cached_categories");
      if (saved && JSON.parse(saved).length > 0) return false;
    } catch (e) {}
    return true;
  });
  const [selectedCats, setSelectedCats] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem("fix_home_selected_cats");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [selectedSubcategories, setSelectedSubcategories] = useState<Record<string, SubCategoryItem[]>>(() => {
    try {
      const saved = localStorage.getItem("fix_home_selected_subcats");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) {}
    return {};
  });

  // Persist in-progress booking selections so they survive an app
  // background/foreground cycle where the WebView gets reloaded
  // (e.g. Android reclaiming memory after switching to another app).
  useEffect(() => {
    try {
      localStorage.setItem("fix_home_selected_cats", JSON.stringify(selectedCats));
    } catch (e) {}
  }, [selectedCats]);

  useEffect(() => {
    try {
      localStorage.setItem("fix_home_selected_subcats", JSON.stringify(selectedSubcategories));
    } catch (e) {}
  }, [selectedSubcategories]);

  const toggleCategorySelection = (cat: Category) => {
    const isCurrentlySelected = selectedCats.some((c) => c.id === cat.id);
    if (isCurrentlySelected) {
      const remaining = selectedCats.filter((c) => c.id !== cat.id);
      setSelectedCats(remaining);
      setSelectedSubcategories((prev) => {
        const copy = { ...prev };
        delete copy[cat.id];
        return copy;
      });
    } else {
      setSelectedCats((prev) => [...prev, cat]);
      setSelectedSubcategories((prev) => ({
        ...prev,
        [cat.id]: []
      }));
    }
  };

  const toggleSubcategorySelection = (catId: string, subItem: SubCategoryItem) => {
    setSelectedSubcategories((prev) => {
      const currentList = prev[catId] || [];
      const exists = currentList.some((s) => s.name === subItem.name);
      let newList;
      if (exists) {
        newList = currentList.filter((s) => s.name !== subItem.name);
      } else {
        newList = [...currentList, subItem];
      }
      return {
        ...prev,
        [catId]: newList
      };
    });
  };

  const getCalculatedSubtotalRange = () => {
    let minTotal = 0;
    let maxTotal = 0;
    selectedCats.forEach((cat) => {
      const subs = selectedSubcategories[cat.id] || [];
      if (subs.length > 0) {
        subs.forEach((s) => {
          const item = parseSubcategoryItem(s);
          const minP = item.minPrice > 0 ? item.minPrice : (item.price || 199);
          const maxP = item.maxPrice > 0 ? item.maxPrice : minP;
          minTotal += minP;
          maxTotal += maxP;
        });
      } else {
        if (cat.subcategories && cat.subcategories.length > 0) {
          let catMin = Infinity;
          let catMax = 0;
          cat.subcategories.forEach((subRaw) => {
            const item = parseSubcategoryItem(subRaw);
            const minP = item.minPrice > 0 ? item.minPrice : (item.price || 199);
            const maxP = item.maxPrice > 0 ? item.maxPrice : minP;
            if (minP < catMin) catMin = minP;
            if (maxP > catMax) catMax = maxP;
          });
          if (catMin !== Infinity) {
            minTotal += catMin;
            maxTotal += catMax > catMin ? catMax : catMin;
          } else {
            minTotal += 199;
            maxTotal += 399;
          }
        } else {
          minTotal += 199;
          maxTotal += 399;
        }
      }
    });
    return { minTotal, maxTotal };
  };

  const formatPriceVal = (minVal: number, maxVal: number) => {
    if (minVal > 0 && maxVal > minVal) {
      return `₹${minVal} - ₹${maxVal}`;
    }
    return `₹${minVal}`;
  };

  const getCalculatedDiscountRange = (minSub: number, maxSub: number) => {
    if (!appliedCoupon) return { minDiscount: 0, maxDiscount: 0 };
    if (appliedCoupon.discountType === "percent") {
      const minD = Math.round(minSub * (appliedCoupon.discountValue / 100));
      const maxD = Math.round(maxSub * (appliedCoupon.discountValue / 100));
      return { minDiscount: minD, maxDiscount: maxD };
    } else {
      const minD = Math.min(minSub, appliedCoupon.discountValue);
      const maxD = Math.min(maxSub, appliedCoupon.discountValue);
      return { minDiscount: minD, maxDiscount: maxD };
    }
  };
  const [bookingStep, setBookingStep] = useState<"services" | "details">(() => {
    try {
      const saved = localStorage.getItem("fix_home_booking_step");
      if (saved === "services" || saved === "details") return saved;
    } catch (e) {}
    return "services";
  });

  useEffect(() => {
    try {
      localStorage.setItem("fix_home_booking_step", bookingStep);
    } catch (e) {}
  }, [bookingStep]);

  // User Portal Tab & Account Credential States
  const [customerPortalTab, setCustomerPortalTab] = useState<"book" | "account">(() => {
    try {
      const saved = localStorage.getItem("fix_home_portal_tab");
      if (saved === "book" || saved === "account") return saved;
    } catch (e) {}
    return "book";
  });

  useEffect(() => {
    try {
      localStorage.setItem("fix_home_portal_tab", customerPortalTab);
    } catch (e) {}
  }, [customerPortalTab]);
  const [userNameInput, setUserNameInput] = useState<string>(() => localStorage.getItem("fix_home_user_name") || "Rajesh Kumar");
  const [userPhoneInput, setUserPhoneInput] = useState<string>(() => localStorage.getItem("fix_home_user_mobile") || "9876543210");
  const [userPasswordInput, setUserPasswordInput] = useState<string>("");
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<boolean>(false);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);

  // Authentication & Login/Register Modal States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginPhoneInput, setLoginPhoneInput] = useState<string>("");
  const [loginPasswordInput, setLoginPasswordInput] = useState<string>("");
  const [registerNameInput, setRegisterNameInput] = useState<string>("");
  const [registerPhoneInput, setRegisterPhoneInput] = useState<string>("");
  const [registerPasswordInput, setRegisterPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Dynamic Coupon States
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    title: string;
    discountText: string;
    discountValue: number;
    discountType: "percent" | "flat";
  } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dynamic History-Based Coupon Generator
  // Dynamic Coupon Generator based on Admin Portal Coupons
  const getHistoryBasedCoupons = (history: Booking[]) => {
    const totalCompleted = history.length;
    const isTe = currentLanguage === "te";

    // Use current offers state or fallback to localStorage cache
    let activeOffersList = offers;
    if (!activeOffersList || activeOffersList.length === 0) {
      try {
        const cached = localStorage.getItem("fix_home_cached_offers");
        if (cached) {
          activeOffersList = JSON.parse(cached);
        }
      } catch (e) {}
    }

    if (!activeOffersList) activeOffersList = [];

    return activeOffersList
      .filter((offer) => offer.is_active !== false)
      .map((offer) => {
        const discountType = offer.discount_type || "percent";
        const discountVal = offer.discount_value || offer.discount_percentage || 0;
        const discountText = discountType === "flat" ? `₹${discountVal} OFF` : `${discountVal}% OFF`;
        const code = (offer.code || `OFFER${discountVal}`).toUpperCase();
        const reqBookings = offer.min_bookings_required || 0;
        const isUnlocked = totalCompleted >= reqBookings;
        const requirementText = reqBookings > 0
          ? (isUnlocked
              ? (isTe ? `అన్‌లాక్ అయింది! (${reqBookings}+ బుకింగ్‌లు)` : `Unlocked! (${reqBookings}+ completed bookings)`)
              : (isTe ? `కనీసం ${reqBookings} పూర్తయిన సేవా బుకింగ్‌లు అవసరం` : `Requires ${reqBookings}+ completed service bookings`))
          : (isTe ? "అందరికీ అన్‌లాక్ అయింది" : "Unlocked for all users");

        return {
          code,
          title: offer.title,
          discountText,
          discountValue: discountVal,
          discountType: discountType as "percent" | "flat",
          description: offer.description,
          requirementText,
          isUnlocked,
          categoryTag: offer.is_festival_offer
            ? (isTe ? "పండుగ ఆఫర్" : "Festival Offer")
            : (isTe ? "కూపన్" : "Coupon")
        };
      });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = userPhoneInput.replace(/\D/g, "");
    if (!isValidPhoneNumber(cleanMobile)) {
      alert(t("errEnterMobile", currentLanguage));
      return;
    }

    const cleanName = userNameInput.trim();
    if (!isValidName(cleanName)) {
      alert(t("errEnterName", currentLanguage));
      return;
    }
    
    // Save to local storage immediately for responsive user feedback
    localStorage.setItem("fix_home_user_name", cleanName);
    localStorage.setItem("fix_home_user_mobile", cleanMobile);
    setUserMobile(cleanMobile);
    setPhone(cleanMobile);
    fetchUserHistory(cleanMobile);
    setUserPasswordInput("");
    setProfileSaveSuccess(true);
    setIsEditingProfile(false);
    setTimeout(() => setProfileSaveSuccess(false), 3500);

    // Sync to backend DB endpoint
    try {
      await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          mobile_number: cleanMobile,
          password: userPasswordInput ? userPasswordInput : undefined
        })
      });
    } catch (err) {
      console.log("Profile update backend sync:", err);
    }
  };

  const handleRedeemCoupon = (coupon: any) => {
    setAppliedCoupon(coupon);
    setCustomerPortalTab("book");
    setCouponMessage(`Coupon ${coupon.code} Applied! ${coupon.discountText} discount will be subtracted on booking.`);
    setTimeout(() => setCouponMessage(""), 6000);
  };

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
    } catch (e) {}
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Form Booking States
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [landmark, setLandmark] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Active Persistent Booking Tracking States
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [viewingTracker, setViewingTracker] = useState<boolean>(false);
  const [refreshingTracker, setRefreshingTracker] = useState<boolean>(false);

  // Cancellation States
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>("");
  const [cancelSuccessToast, setCancelSuccessToast] = useState<string>("");

  // Specialist Direct Call Helpers
  const getWorkerDisplayPhone = (booking?: Booking | null) => {
    return booking?.assigned_worker_phone || "+91 99667 47473";
  };

  const getWorkerTelUri = (booking?: Booking | null) => {
    const raw = getWorkerDisplayPhone(booking);
    const cleaned = raw.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return `tel:${cleaned}`;
    if (cleaned.length === 10) return `tel:+91${cleaned}`;
    return `tel:${cleaned}`;
  };

  const triggerCallWorker = (e?: React.MouseEvent, booking?: Booking | null) => {
    const rawNumber = getWorkerDisplayPhone(booking || activeBooking);
    dialNativePhoneNumber(rawNumber);
  };

  // Touch Pull to Refresh Feature States
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);
  const touchStartYRef = useRef<number | null>(null);

  // Unified manual refresh function for Pull-to-Refresh gesture & refresh buttons
  const handleManualRefresh = async () => {
    setIsPullRefreshing(true);
    setRefreshingTracker(true);
    try {
      const activeId = localStorage.getItem("fix_home_active_booking_id") || (activeBooking ? activeBooking.request_id : null);
      const promises: Promise<any>[] = [];

      if (activeId) {
        promises.push(fetchBookingStatus(activeId, false));
      }
      const currentMobile = localStorage.getItem("fix_home_user_mobile") || userMobile;
      if (currentMobile) {
        promises.push(fetchUserHistory(currentMobile));
      }
      promises.push(fetchCategories());
      promises.push(fetchOffers());

      await Promise.all(promises);
    } catch (err) {
      console.error("Manual pull refresh error:", err);
    } finally {
      setTimeout(() => {
        setIsPullRefreshing(false);
        setRefreshingTracker(false);
        setPullDistance(0);
      }, 400);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const isAtTop = typeof window === "undefined" || window.scrollY <= 3 || document.documentElement.scrollTop <= 3;
    if (isAtTop) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartYRef.current;
    
    const isAtTop = typeof window === "undefined" || window.scrollY <= 3 || document.documentElement.scrollTop <= 3;

    if (dy > 0 && isAtTop) {
      const dist = Math.min(85, Math.pow(dy, 0.82) * 1.3);
      if (dist > 5) {
        setPullDistance(dist);
      }
    } else {
      if (pullDistance > 0) {
        setPullDistance(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current !== null) {
      if (pullDistance >= 55 && !isPullRefreshing) {
        handleManualRefresh();
      } else {
        setPullDistance(0);
      }
      touchStartYRef.current = null;
    }
  };

  const renderPullToRefreshHeader = () => {
    if (pullDistance <= 0 && !isPullRefreshing) return null;
    const isTe = currentLanguage === "te";
    const thresholdMet = pullDistance >= 55;

    return (
      <div 
        className="w-full flex items-center justify-center overflow-hidden transition-all duration-200 bg-emerald-50/90 border-b border-emerald-200/80 text-[#65a30d] shrink-0 sticky top-0 z-40 backdrop-blur-xs shadow-2xs"
        style={{
          height: isPullRefreshing ? "52px" : `${pullDistance}px`,
          opacity: isPullRefreshing ? 1 : Math.min(1, pullDistance / 40)
        }}
      >
        <div className="flex items-center gap-2 text-xs font-bold py-2 px-4 select-none">
          <RefreshCw
            size={16}
            className={`stroke-[2.5] ${isPullRefreshing ? "animate-spin text-[#65a30d]" : "text-[#65a30d]"}`}
            style={{
              transform: isPullRefreshing ? "none" : `rotate(${pullDistance * 4}deg)`
            }}
          />
          <span className="text-[11px] sm:text-xs font-extrabold tracking-tight">
            {isPullRefreshing
              ? (isTe ? "స్టేటస్ & బుకింగ్‌లను నవీకరిస్తోంది..." : "Refreshing booking status & dispatches...")
              : thresholdMet
              ? (isTe ? "నవీకరించడానికి వేలిని వదలండి ↑" : "Release to refresh status ↑")
              : (isTe ? "నవీకరించడానికి క్రిందకు లాగండి ↓" : "Pull down to refresh status ↓")}
          </span>
        </div>
      </div>
    );
  };

  // Active booking tracking reference
  const prevBookingStateRef = useRef<{ workerName?: string; status?: string } | null>(null);
  const dismissedBookingIdsRef = useRef<Set<string>>(new Set());

  // Helper function to send Native Mobile Push Notifications to OS Notification Shade & Lock Screen for Admin
  const triggerMobilePushNotification = async (title: string, body: string, tag?: string) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const notificationOptions: NotificationOptions = {
      body,
      icon: "/fixhome_logo.jpg",
      badge: "/fixhome_logo.jpg",
      tag: tag || "fixhome-mobile-alert",
      vibrate: [500, 200, 500, 200, 500],
      requireInteraction: true,
      renotify: true,
      data: { url: "/" }
    } as any;

    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, notificationOptions);
          return;
        }
      } catch (e) {}
    }

    try {
      new Notification(title, notificationOptions);
    } catch (e) {}
  };

  // Monitor active booking state transitions
  useEffect(() => {
    if (activeBooking) {
      prevBookingStateRef.current = {
        workerName: activeBooking.assigned_worker_name,
        status: activeBooking.status
      };
    }
  }, [activeBooking]);

  // Notify parent component if booking tracker is being viewed on page
  useEffect(() => {
    if (onTrackerStateChange) {
      onTrackerStateChange(Boolean(viewingTracker && activeBooking));
    }
  }, [viewingTracker, activeBooking, onTrackerStateChange]);

  // Fetch categories & offers on load
  useEffect(() => {
    fetchCategories();
    fetchOffers();

    const storedMobile = localStorage.getItem("fix_home_user_mobile") || "";
    if (storedMobile) {
      setUserMobile(storedMobile);
      setPhone(storedMobile);
      fetchUserHistory(storedMobile);
    }

    // Check for existing active booking in localStorage
    const savedBookingId = secureStorage.getItem<string>("fix_home_active_booking_id") || localStorage.getItem("fix_home_active_booking_id");
    if (savedBookingId) {
      fetchBookingStatus(savedBookingId, true);
    }

    const handleRealtimeStatusEvent = (e: any) => {
      const data = e.detail || e.data;
      if (!data) return;
      const activeId = localStorage.getItem("fix_home_active_booking_id");
      const targetId = data.bookingId || data.request_id || (data.booking && data.booking.request_id);

      if (activeId && activeId === targetId) {
        fetchBookingStatus(activeId, false);
      }
    };

    // BroadcastChannel listener for instant status updates & worker assignments
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("fix_home_channel");
        bc.onmessage = (e) => {
          if (e.data) {
            handleRealtimeStatusEvent(e);
          }
        };
      } catch (err) {}
    }

    const customEventListener = (e: any) => {
      handleRealtimeStatusEvent(e);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "fix_home_cached_categories" || !e.key) {
        fetchCategories();
      }
      if (e.key === "fix_home_cached_offers" || !e.key) {
        fetchOffers();
      }
    };

    window.addEventListener("fix_home_status_updated", customEventListener);
    window.addEventListener("storage", handleStorageChange);

    // Subscribe to Firestore real-time changes across devices
    const unsubCats = subscribeCategoriesRealtime((realtimeCategories) => {
      if (Array.isArray(realtimeCategories) && realtimeCategories.length > 0) {
        setCategories(realtimeCategories);
        setLoadingCats(false);
        try {
          localStorage.setItem("fix_home_cached_categories", JSON.stringify(realtimeCategories));
        } catch (e) {}
      }
    });

    const unsubOffers = subscribeOffersRealtime((realtimeOffers) => {
      if (Array.isArray(realtimeOffers)) {
        const active = realtimeOffers.filter((o: Offer) => o.is_active !== false);
        setOffers(active);
        try {
          localStorage.setItem("fix_home_cached_offers", JSON.stringify(active));
        } catch (e) {}
      }
    });

    const unsubSignal = subscribeGlobalSignalRealtime(() => {
      fetchCategories();
      fetchOffers();
      const mobile = userMobile || localStorage.getItem("fix_home_user_mobile") || "";
      if (mobile) {
        fetchUserHistory(mobile);
      }
      const savedBookingId = secureStorage.getItem<string>("fix_home_active_booking_id") || localStorage.getItem("fix_home_active_booking_id");
      if (savedBookingId) {
        fetchBookingStatus(savedBookingId, false);
      }
    });

    return () => {
      if (bc) bc.close();
      window.removeEventListener("fix_home_status_updated", customEventListener);
      window.removeEventListener("storage", handleStorageChange);
      unsubCats();
      unsubOffers();
      unsubSignal();
    };
  }, []);

  // Navigation state ref to ensure synchronous, closure-safe access during hardware & gesture back events
  const navStateRef = useRef({
    gpsModalOpen,
    historyModalOpen,
    viewingTracker,
    viewingFullPrivacy,
    bookingStep,
    customerPortalTab,
    isEditingProfile,
  });

  useEffect(() => {
    navStateRef.current = {
      gpsModalOpen,
      historyModalOpen,
      viewingTracker,
      viewingFullPrivacy,
      bookingStep,
      customerPortalTab,
      isEditingProfile,
    };
  });

  // Keep native shell (App.js) instantly notified of whether user is in a sub-view or at the root
  useEffect(() => {
    const isSubView = Boolean(
      gpsModalOpen ||
      historyModalOpen ||
      viewingTracker ||
      viewingFullPrivacy ||
      isEditingProfile ||
      bookingStep !== "services" ||
      customerPortalTab !== "book"
    );
    notifyNativeBackState(isSubView);
  }, [
    gpsModalOpen,
    historyModalOpen,
    viewingTracker,
    viewingFullPrivacy,
    isEditingProfile,
    bookingStep,
    customerPortalTab,
  ]);

  useEffect(() => {
    // Register active back action handler for direct hardware back navigation
    (window as any).__customerPortalBack = () => {
      const current = navStateRef.current;
      logNav("CustomerPortal", "__customerPortalBack invoked", current);

      // 1. Modals (close any open modal)
      if (current.gpsModalOpen) {
        setGpsModalOpen(false);
        notifyNativeBackState(false);
        return true;
      }
      if (current.historyModalOpen) {
        setHistoryModalOpen(false);
        notifyNativeBackState(false);
        return true;
      }
      if (current.isEditingProfile) {
        setIsEditingProfile(false);
        notifyNativeBackState(false);
        return true;
      }
      if (current.viewingTracker) {
        setViewingTracker(false);
        setBookingStep("services");
        setSelectedCats([]);
        setSelectedSubcategories({});
        notifyNativeBackState(false);
        return true;
      }
      if (current.viewingFullPrivacy) {
        setViewingFullPrivacy(false);
        notifyNativeBackState(false);
        return true;
      }

      // 2. Booking Step (Step 2 Details -> Step 1 Services)
      if (current.bookingStep === "details") {
        setBookingStep("services");
        notifyNativeBackState(false);
        return true;
      }

      // 3. Tab (Account -> Book Services)
      if (current.customerPortalTab === "account") {
        setCustomerPortalTab("book");
        setBookingStep("services");
        notifyNativeBackState(false);
        return true;
      }

      // 4. At Root Services Page (let root 2-tap exit handler handle it)
      notifyNativeBackState(false);
      return false;
    };

    (window as any).__syncNativeBackState = () => {
      const current = navStateRef.current;
      const isSubView = Boolean(
        current.gpsModalOpen ||
        current.historyModalOpen ||
        current.viewingTracker ||
        current.viewingFullPrivacy ||
        current.isEditingProfile ||
        current.bookingStep !== "services" ||
        current.customerPortalTab !== "book"
      );
      notifyNativeBackState(isSubView);
    };

    return () => {
      delete (window as any).__customerPortalBack;
      delete (window as any).__syncNativeBackState;
    };
  }, []);

  const fetchOffers = async () => {
    if (offers.length === 0) setLoadingOffers(true);
    try {
      const res = await fetch(`/api/offers?t=${Date.now()}`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const active = data.filter((o: Offer) => o.is_active !== false);
          setOffers(active);
          try {
            localStorage.setItem("fix_home_cached_offers", JSON.stringify(active));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Offers fetch notice:", err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const fetchUserHistory = async (mobile: string) => {
    if (!mobile || !mobile.trim()) return;
    setLoadingHistory(true);
    const clean = mobile.trim();
    const cleanDigits = clean.replace(/\D/g, "");

    // 1. Retrieve offline local bookings saved in browser storage
    let localBookings: Booking[] = [];
    try {
      const raw = localStorage.getItem("fix_home_all_bookings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localBookings = parsed.filter((b: any) => {
            const bPhone = (b.mobile_number || "").replace(/\D/g, "");
            return bPhone.length > 0 && (bPhone.includes(cleanDigits) || cleanDigits.includes(bPhone));
          });
        }
      }
    } catch (e) {}

    // Initialize map with local bookings
    const mergedMap = new Map<string, Booking>();
    localBookings.forEach(b => {
      if (b && b.request_id) mergedMap.set(b.request_id, b);
    });

    // 2. Try fetching from backend API
    try {
      const res = await fetch(`/api/bookings/user/${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        const serverBookings: Booking[] = data.bookings || [];
        serverBookings.forEach(b => {
          if (b && b.request_id) mergedMap.set(b.request_id, b);
        });
      }
    } catch (apiErr) {
      // Backend is unreachable or offline, fallback smoothly
    }

    // 3. Fallback / supplementary query to Firestore
    try {
      const firestoreBookings = await fetchUserBookingsFromFirestore(clean);
      firestoreBookings.forEach(b => {
        if (b && b.request_id) mergedMap.set(b.request_id, b);
      });
    } catch (fsErr) {}

    const combined = Array.from(mergedMap.values()).sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    setUserHistory(combined);
    setLoadingHistory(false);
  };

  const handleUserMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleanMobile = loginPhoneInput.replace(/\D/g, "");
    if (!isValidPhoneNumber(cleanMobile)) {
      setAuthError(t("errEnterMobile", currentLanguage));
      return;
    }
    if (!loginPasswordInput) {
      setAuthError("Please enter your account password.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: cleanMobile, password: loginPasswordInput })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || "Login failed. Check your password.");
        return;
      }

      setUserMobile(data.user.mobile_number);
      if (data.user.name) setUserNameInput(data.user.name);
      setPhone(data.user.mobile_number);
      setUserPhoneInput(data.user.mobile_number);
      localStorage.setItem("fix_home_user_mobile", data.user.mobile_number);
      if (data.user.name) localStorage.setItem("fix_home_user_name", data.user.name);
      fetchUserHistory(data.user.mobile_number);
      setLoginPasswordInput("");
      setAuthError("");
    } catch (err) {
      setAuthError("Server communication error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleanName = registerNameInput.trim();
    const cleanMobile = registerPhoneInput.replace(/\D/g, "");

    if (!isValidName(cleanName)) {
      setAuthError(t("errEnterName", currentLanguage));
      return;
    }
    if (!isValidPhoneNumber(cleanMobile)) {
      setAuthError(t("errEnterMobile", currentLanguage));
      return;
    }
    if (!registerPasswordInput || registerPasswordInput.length < 4) {
      setAuthError("Password must be at least 4 characters long.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, mobile_number: cleanMobile, password: registerPasswordInput })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || "Registration failed. Please try again.");
        return;
      }

      setUserMobile(data.user.mobile_number);
      setUserNameInput(data.user.name);
      setPhone(data.user.mobile_number);
      setUserPhoneInput(data.user.mobile_number);
      localStorage.setItem("fix_home_user_mobile", data.user.mobile_number);
      localStorage.setItem("fix_home_user_name", data.user.name);
      fetchUserHistory(data.user.mobile_number);
      setRegisterNameInput("");
      setRegisterPhoneInput("");
      setRegisterPasswordInput("");
      setAuthError("");
    } catch (err) {
      setAuthError("Server error during registration. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserLogout = () => {
    setUserMobile("");
    setUserHistory([]);
    setUserNameInput("");
    setUserPhoneInput("");
    localStorage.removeItem("fix_home_user_mobile");
    localStorage.removeItem("fix_home_user_name");
    localStorage.removeItem("fix_home_user_id");
    localStorage.removeItem("fix_home_active_booking_id");
    setCustomerPortalTab("book");
    if (onLogout) {
      onLogout();
    }
  };

  // Subscribe to real-time active booking updates from Firestore
  useEffect(() => {
    const bookingId = activeBooking?.request_id || secureStorage.getItem<string>("fix_home_active_booking_id") || localStorage.getItem("fix_home_active_booking_id");
    if (!bookingId) return;

    const unsubBooking = subscribeBookingRealtime(bookingId, (updatedBooking) => {
      if (dismissedBookingIdsRef.current.has(bookingId)) return;
      setActiveBooking(updatedBooking);
    });

    const interval = setInterval(() => {
      fetchBookingStatus(bookingId, false);
    }, 5000);

    return () => {
      unsubBooking();
      clearInterval(interval);
    };
  }, [activeBooking?.request_id]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories?t=${Date.now()}`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        const catList = Array.isArray(data) && data.length > 0 ? data : DEFAULT_CATEGORIES;
        setCategories(catList);
        try {
          localStorage.setItem("fix_home_cached_categories", JSON.stringify(catList));
        } catch (e) {}
      } else {
        setCategories((prev) => (prev && prev.length > 0 ? prev : DEFAULT_CATEGORIES));
      }
    } catch (err) {
      console.warn("Categories fetch notice:", err);
      setCategories((prev) => (prev && prev.length > 0 ? prev : DEFAULT_CATEGORIES));
    } finally {
      setLoadingCats(false);
    }
  };

  const fetchBookingStatus = async (requestId: string, autoShowTracker: boolean = false) => {
    setRefreshingTracker(true);
    try {
      const res = await fetch(`/api/bookings/track/${requestId}`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && data.booking) {
          if (dismissedBookingIdsRef.current.has(requestId)) return;
          setActiveBooking(data.booking);
          if (autoShowTracker) {
            setViewingTracker(true);
          }
        }
      } else if (res.status === 404) {
        // If expired or not found, clear localStorage
        secureStorage.removeItem("fix_home_active_booking_id");
        localStorage.removeItem("fix_home_active_booking_id");
        setActiveBooking(null);
        setViewingTracker(false);
      }
    } catch (err) {
      console.error("Error fetching booking tracking status:", err);
    } finally {
      setRefreshingTracker(false);
    }
  };

  // --- PRIVACY HANDLER ---
  const handleAcceptPrivacy = () => {
    localStorage.setItem("fix_home_privacy_accepted", "true");
    setPrivacyAccepted(true);
  };

  // --- GPS PERMISSION AND GEOLOCATION CORE ---
  const searchAddressAutocomplete = (query: string) => {
    if (!query || query.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearchingAddress(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&addressdetails=1`, {
      headers: { "Accept-Language": "en" }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAddressSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      })
      .catch((err) => {
        console.error("Address autocomplete search error:", err);
      })
      .finally(() => {
        setIsSearchingAddress(false);
      });
  };

  const selectAddressSuggestion = (suggestion: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setCoords({ lat, lng: lon });
      setAddress(suggestion.display_name);
      setGpsPermissionGranted(true);
      setGpsStatusText("Exact location locked on map!");
      setShowSuggestions(false);
      setAddressSuggestions([]);
    }
  };

  const geocodeManualAddress = (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 3) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`, {
      headers: { "Accept-Language": "en" }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            setCoords({ lat, lng: lon });
            setGpsPermissionGranted(true);
            setGpsStatusText("Map pin updated to entered address!");
          }
        }
      })
      .catch((err) => {
        console.error("Manual address geocoding error:", err);
      });
  };

  const triggerGpsPrompt = () => {
    handleConfirmGpsPermission();
  };

  const handleConfirmGpsPermission = () => {
    logNav("CustomerPortal", "handleConfirmGpsPermission");
    setGpsModalOpen(false);
    setLocating(true);
    setGpsStatusText("Locking onto satellite & Wi-Fi GPS location...");

    const reverseGeocode = (lat: number, lng: number, accuracyMeters?: number) => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { "Accept-Language": "en" }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.address) {
            const a = data.address;
            const house = a.house_number || a.building || a.house_name || "";
            const road = a.road || a.pedestrian || a.street || a.path || "";
            const area = a.suburb || a.neighbourhood || a.residential || a.subdistrict || "";
            const city = a.city || a.town || a.village || a.city_district || a.county || "";
            const state = a.state || "";
            const postcode = a.postcode || "";

            const parts = [
              [house, road].filter(Boolean).join(" "),
              area,
              city,
              state ? `${state}${postcode ? " - " + postcode : ""}` : postcode
            ].filter(Boolean);

            const formatted = parts.length > 0 ? parts.join(", ") : (data.display_name || "");
            if (formatted) {
              setAddress(formatted);
            }
            const accText = accuracyMeters ? ` (~${Math.round(accuracyMeters)}m accuracy)` : "";
            setGpsStatusText(`Exact location locked!${accText}`);
          } else if (data && data.display_name) {
            setAddress(data.display_name);
            setGpsStatusText("Exact address resolved successfully!");
          } else {
            setGpsStatusText("Exact GPS coordinates locked!");
          }
        })
        .catch((err) => {
          console.error("Reverse geocoding error:", err);
          setGpsStatusText("GPS coordinates locked!");
        })
        .finally(() => {
          setLocating(false);
        });
    };

    const fallbackToIpLocation = () => {
      setGpsStatusText("Estimating area via network connection...");
      fetch("https://ipapi.co/json/")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.latitude && data.longitude) {
            const newCoords = { lat: data.latitude, lng: data.longitude };
            setCoords(newCoords);
            setGpsPermissionGranted(true);
            const resolvedAddr = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
            if (resolvedAddr && !address) {
              setAddress(resolvedAddr);
            }
            setGpsStatusText(`Estimated area set (${data.city || "Local Area"}). Use search below to pin your exact building.`);
          } else {
            fallbackDefaultLocation();
          }
        })
        .catch(() => {
          fallbackDefaultLocation();
        })
        .finally(() => {
          setLocating(false);
        });
    };

    const fallbackDefaultLocation = () => {
      if (address && address.trim().length >= 3) {
        geocodeManualAddress(address);
      } else {
        const defaultCoords = { lat: 28.6139, lng: 77.2090 };
        setCoords(defaultCoords);
        setGpsPermissionGranted(true);
        setGpsStatusText("Map pin set! Type or select your detailed street address below.");
      }
      setLocating(false);
    };

    if (!navigator.geolocation) {
      fallbackToIpLocation();
      return;
    }

    let bestAcc = Infinity;
    let watchId: number | null = null;
    let hasUpdated = false;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        hasUpdated = true;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        setGpsAccuracy(acc);

        if (acc < bestAcc || bestAcc === Infinity) {
          bestAcc = acc;
          const newCoords = { lat, lng };
          setCoords(newCoords);
          setGpsPermissionGranted(true);
          setGpsStatusText(`GPS fix locked (${Math.round(acc)}m accuracy). Resolving address...`);
          reverseGeocode(lat, lng, acc);
        }

        if (acc <= 35) {
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          setLocating(false);
        }
      },
      (error) => {
        console.warn("Geolocation watch error, attempting fallback:", error);
        if (!hasUpdated) {
          fallbackToIpLocation();
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setTimeout(() => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setLocating(false);
    }, 12000);
  };

  // --- SUBMIT BOOKING HANDLER ---
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!navigator.onLine) {
      window.dispatchEvent(new Event("fix_home_trigger_offline"));
      setFormError("You are offline. Please turn on mobile data or wifi.");
      return;
    }

    if (selectedCats.length === 0) {
      setFormError("Please select at least one repair service category first.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!isValidPhoneNumber(cleanPhone)) {
      setFormError(t("errEnterMobile", currentLanguage));
      return;
    }

    if (!address.trim()) {
      setFormError("An explicit physical address is required to dispatch agents.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { minTotal, maxTotal } = getCalculatedSubtotalRange();
      const { minDiscount, maxDiscount } = getCalculatedDiscountRange(minTotal, maxTotal);
      const minPayable = Math.max(0, minTotal - minDiscount);
      const maxPayable = Math.max(0, maxTotal - maxDiscount);
      const finalTotal = minPayable;

      const selectedSummaryItems = selectedCats.map((cat) => {
        const subs = selectedSubcategories[cat.id] || [];
        if (subs.length > 0) {
          const subStr = subs.map((s) => {
            const formatted = formatSubcategoryDisplay(s);
            return formatted.displayPrice ? `${formatted.name} (${formatted.displayPrice})` : formatted.name;
          }).join(", ");
          return `${cat.name}: ${subStr}`;
        }
        return cat.name;
      });
      const combinedServiceType = selectedSummaryItems.join(" | ");

      const generatedMapsUrl = coords 
        ? `https://maps.google.com/?q=${coords.lat},${coords.lng}`
        : address.trim()
          ? `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`
          : null;
      const couponNote = appliedCoupon 
        ? `[Applied Coupon: ${appliedCoupon.code} (${appliedCoupon.discountText})]` 
        : "";
      const finalNotes = [notes, couponNote].filter(Boolean).join(" • ");

      const payload = {
        service_type: combinedServiceType,
        mobile_number: phone,
        address: address,
        latitude: coords ? coords.lat : null,
        longitude: coords ? coords.lng : null,
        google_maps_url: generatedMapsUrl,
        landmark: landmark || undefined,
        additional_notes: finalNotes || undefined,
        amount: minTotal,
        discount_applied: minDiscount,
        final_amount: finalTotal
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Save request ID securely for persistent tracking
        secureStorage.setItem("fix_home_active_booking_id", data.booking.request_id);
        localStorage.setItem("fix_home_active_booking_id", data.booking.request_id);

        // INSTANT UI TRANSITION - Update states immediately so user sees Live Tracker without lag
        setActiveBooking(data.booking);
        setViewingTracker(true);
        setBookingStep("services");
        setSelectedCats([]);
        setSelectedSubcategories({});

        // Clear forms immediately
        setPhone("");
        setAddress("");
        setLandmark("");
        setNotes("");
        setCoords(null);
        setGpsPermissionGranted(null);
        setIsSubmitting(false);

        // NON-BLOCKING BACKGROUND TASKS (Firestore sync, LocalStorage backup, Push Notifications)
        setTimeout(() => {
          // Sync sanitized booking document to Firestore collection "bookings" for real-time admin listening
          try {
            const sanitizedDoc = {
              ...data.booking,
              customer_name: sanitizeNameInput(data.booking.customer_name || ""),
              mobile_number: String(data.booking.mobile_number || "").replace(/\D/g, "").substring(0, 10),
              createdAtFirestore: new Date().toISOString()
            };
            setDoc(doc(db, "bookings", data.booking.request_id), sanitizedDoc).catch((e) => {
              console.warn("Firestore booking sync background error:", e);
            });
          } catch (e) {}

          // Backup booking locally so details are never lost even across admin logouts or server restarts
          try {
            const existingRaw = localStorage.getItem("fix_home_all_bookings");
            const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
            const updated = [data.booking, ...existing.filter((b: any) => b.request_id !== data.booking.request_id)];
            localStorage.setItem("fix_home_all_bookings", JSON.stringify(updated));
          } catch (e) {
            console.error("Local storage sync error:", e);
          }

          // Dispatch live event, BroadcastChannel & Mobile Push Notification to notify Admin on mobile
          window.dispatchEvent(new CustomEvent("fix_home_new_booking", { detail: data.booking }));
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const bc = new BroadcastChannel("fix_home_channel");
              bc.postMessage({ type: "NEW_BOOKING", booking: data.booking });
              bc.close();
            }
          } catch (e) {}

          // Send Mobile Push Notification directly to Admin device
          try {
            triggerMobilePushNotification(
              "🚨 NEW SERVICE BOOKING RECEIVED!",
              `Service: ${data.booking.service_type}\nMobile: ${data.booking.mobile_number || 'Customer'}\nAddress: ${data.booking.address || 'Address provided'}`,
              "admin-booking-" + data.booking.request_id
            );
          } catch (e) {}

          try {
            sendFCMPushNotification({
              targetRole: "admin",
              title: "🚨 NEW SERVICE BOOKING RECEIVED!",
              body: `Service: ${data.booking.service_type} | Mobile: ${data.booking.mobile_number || 'Customer'}`,
              data: { bookingId: data.booking.request_id, type: "admin_alert" }
            });
          } catch (e) {}
        }, 0);
        return;
      } else {
        let errorMsg = data.error || "Failed to submit booking request. Please check your inputs.";
        if (errorMsg.includes("Admin authorization") || errorMsg.includes("Access denied")) {
          errorMsg = "Server session error. Retrying submission...";
          // Re-try submission cleanly
          try {
            const retryRes = await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const retryData = await retryRes.json();
            if (retryRes.ok && retryData.success) {
              localStorage.setItem("fix_home_active_booking_id", retryData.booking.request_id);
              try {
                const existingRaw = localStorage.getItem("fix_home_all_bookings");
                const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
                const updated = [retryData.booking, ...existing.filter((b: any) => b.request_id !== retryData.booking.request_id)];
                localStorage.setItem("fix_home_all_bookings", JSON.stringify(updated));
              } catch (e) {}
              window.dispatchEvent(new CustomEvent("fix_home_new_booking", { detail: retryData.booking }));
              setActiveBooking(retryData.booking);
              setViewingTracker(true);
              setBookingStep("services");
              setSelectedCats([]);
              setSelectedSubcategories({});
              setPhone("");
              setAddress("");
              setLandmark("");
              setNotes("");
              setCoords(null);
              setGpsPermissionGranted(null);
              return;
            }
          } catch (e) {}
          errorMsg = "Failed to submit booking request. Please try again.";
        }
        setFormError(errorMsg);
      }
    } catch (err) {
      setFormError("Network error. Please confirm your local connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissActiveBooking = () => {
    if (activeBooking?.request_id) {
      dismissedBookingIdsRef.current.add(activeBooking.request_id);
    }
    localStorage.removeItem("fix_home_active_booking_id");
    setActiveBooking(null);
    setViewingTracker(false);
    setSelectedCats([]);
    setBookingStep("services");
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    if (activeBooking.status !== "Pending" || activeBooking.assigned_worker_id || activeBooking.assigned_worker_name) {
      setCancelError(
        currentLanguage === "te"
          ? "టెక్నీషియన్ కేటాయించిన తర్వాత సేవను రద్దు చేయలేరు."
          : "Service cannot be cancelled after a technician has been assigned."
      );
      return;
    }

    setIsCancellingBooking(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/bookings/${activeBooking.request_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCancelError(data.error || "Failed to cancel service request.");
        return;
      }

      // Sync cancellation to Firestore if available
      try {
        if (data.booking) {
          syncBookingToFirestore(data.booking);
        }
      } catch (e) {}

      // Update LocalStorage records
      try {
        const raw = localStorage.getItem("fix_home_all_bookings");
        if (raw) {
          const list: Booking[] = JSON.parse(raw);
          const updatedList = list.map((b) =>
            b.request_id === activeBooking.request_id
              ? {
                  ...b,
                  status: "Cancelled" as const,
                  mobile_number: null,
                  address: null,
                  latitude: null,
                  longitude: null,
                  google_maps_url: null,
                  landmark: null,
                  additional_notes: null,
                  is_personal_data_deleted: true
                }
              : b
          );
          localStorage.setItem("fix_home_all_bookings", JSON.stringify(updatedList));
        }
      } catch (e) {}

      // Update User history if logged in
      const currentMobile = localStorage.getItem("fix_home_user_mobile") || userMobile;
      if (currentMobile) {
        fetchUserHistory(currentMobile);
      }

      // Close modal and set success message
      setShowCancelModal(false);
      setCancelSuccessToast(
        currentLanguage === "te"
          ? "సర్వీస్ అభ్యర్థన రద్దు చేయబడింది. మీ వ్యక్తిగత వివరాలు రికార్డుల నుండి తొలగించబడ్డాయి."
          : "Service request cancelled. Customer personal details have been automatically deleted."
      );
      setTimeout(() => setCancelSuccessToast(""), 6000);

      // Update activeBooking state
      if (data.booking) {
        setActiveBooking(data.booking);
      } else {
        setActiveBooking({
          ...activeBooking,
          status: "Cancelled",
          mobile_number: null,
          address: null,
          is_personal_data_deleted: true
        });
      }

      // Broadcast status update event
      window.dispatchEvent(
        new CustomEvent("fix_home_status_updated", {
          detail: {
            bookingId: activeBooking.request_id,
            status: "Cancelled"
          }
        })
      );
    } catch (err: any) {
      setCancelError(
        currentLanguage === "te"
          ? "నెట్‌వర్క్ లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి."
          : "Network error while cancelling booking. Please try again."
      );
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const renderFooter = () => {
    return (
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-white border-t border-slate-800 shadow-2xl px-4 pt-2 safe-bottom-nav">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-around">
          <button
            onClick={() => {
              logNav("CustomerPortal", "Clicked Book Service footer tab", { currentTab: customerPortalTab });
              setCustomerPortalTab("book");
              setBookingStep("services");
              setViewingTracker(false);
              setViewingFullPrivacy(false);
              setHistoryModalOpen(false);
              setGpsModalOpen(false);
            }}
            className={`flex flex-col items-center gap-1 py-1 px-6 rounded-xl transition-all cursor-pointer ${
              customerPortalTab === "book" && !viewingTracker
                ? "text-[#65a30d] font-bold bg-slate-800/90 shadow-2xs"
                : "text-slate-400 hover:text-slate-200 font-medium"
            }`}
          >
            <Wrench size={18} />
            <span className="text-[11px] tracking-tight">{t("bookServicesTab", currentLanguage) || "Book Service"}</span>
          </button>

          <button
            onClick={() => {
              logNav("CustomerPortal", "Clicked Account footer tab", { currentTab: customerPortalTab });
              setCustomerPortalTab("account");
              setViewingTracker(false);
              setViewingFullPrivacy(false);
              setHistoryModalOpen(false);
              setGpsModalOpen(false);
            }}
            className={`flex flex-col items-center gap-1 py-1 px-6 rounded-xl transition-all cursor-pointer ${
              customerPortalTab === "account" && !viewingTracker
                ? "text-[#65a30d] font-bold bg-slate-800/90 shadow-2xs"
                : "text-slate-400 hover:text-slate-200 font-medium"
            }`}
          >
            <User size={18} />
            <span className="text-[11px] tracking-tight">{t("accountAndRewards", currentLanguage) || "My Account"}</span>
          </button>
        </div>
      </footer>
    );
  };

  // --- VIEW RENDER SEGMENTS ---

  // 1. PRIVACY POLICY GATE
  if (privacyAccepted === false) {
    return (
      <>
        <div id="privacy-gate" className="flex-1 flex flex-col justify-between bg-white px-6 py-6 min-h-[520px] pb-16">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-col items-center text-center pb-3 border-b border-slate-100 shrink-0">
              <div className="w-12 h-12 bg-[#e2f1e7] text-[#65a30d] rounded-xl flex items-center justify-center mb-2 shadow-xs border border-[#d1e7da]">
                <ShieldCheck size={28} className="stroke-[2.5]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e293b] tracking-tight">FixHome Privacy Agreement</h2>
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
        {renderFooter()}
      </>
    );
  }

  // 1.5 VIEW FULL PRIVACY POLICY OVERLAY (ACCESSIBLE ANYTIME)
  if (viewingFullPrivacy) {
    return (
      <>
        <div className="pb-16">
          <PrivacyPolicy 
            showBackHeader={true} 
            onBack={() => {
              logNav("CustomerPortal", "PrivacyPolicy onBack clicked");
              setViewingFullPrivacy(false);
            }} 
          />
        </div>
        {renderFooter()}
      </>
    );
  }

  // 2. LIVE SERVICE PROGRESS TRACKER PAGE
  if (viewingTracker && activeBooking) {
    const isTe = currentLanguage === "te";
    // Status Stage Calculations
    const statusOrder = ["Pending", "Assigned", "In Progress", "Completed"];
    const currentIdx = statusOrder.indexOf(activeBooking.status) !== -1 
      ? statusOrder.indexOf(activeBooking.status) 
      : 0;

    const stages = [
      {
        key: "Pending",
        title: isTe ? "రిక్వెస్ట్ నమోదు చేయబడింది" : "Request Logged",
        desc: isTe ? "మా ప్రతినిధి మిమ్మల్ని త్వరలోనే సంప్రదిస్తారు" : "our agent will contact you in a while",
        icon: FileText
      },
      {
        key: "Assigned",
        title: isTe ? "టెక్నీషియన్ కేటాయించబడ్డారు" : "Technician Assigned",
        desc: isTe ? "మీ లొకేషన్‌కు డిస్పాచ్ ఏజెంట్ కేటాయించబడ్డారు" : "Dispatch agent allocated to your location",
        icon: UserCheck
      },
      {
        key: "In Progress",
        title: isTe ? "సేవ పురోగతిలో ఉంది" : "Service In Progress",
        desc: isTe ? "టెక్నీషియన్ రిపేర్ పనిని నిర్వహిస్తున్నారు" : "Technician performing repair work",
        icon: Activity
      },
      {
        key: "Completed",
        title: isTe ? "సేవ పూర్తయింది" : "Service Completed",
        desc: isTe ? "రిపేర్ విజయవంతంగా పూర్తయింది & ముగిసింది" : "Repair successfully finished & closed",
        icon: CheckCircle2
      }
    ];

    return (
      <>
        <div id="booking-tracker" className="flex-1 flex flex-col justify-between bg-white p-5 sm:p-6 animate-fade-in pb-16 relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {renderPullToRefreshHeader()}
          <div className="space-y-6">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  logNav("CustomerPortal", "Clicked Tracker view back button");
                  setViewingTracker(false);
                  setBookingStep("services");
                  setSelectedCats([]);
                  setSelectedSubcategories({});
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title={isTe ? "సేవలకు తిరిగి వెళ్లండి" : "Back to services"}
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="text-base font-bold text-[#1e293b] flex items-center gap-2">
                  <span>{isTe ? "లైవ్ సేవా పురోగతి" : "Live Service Progress"}</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#65a30d] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#65a30d]"></span>
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isTe ? "అడ్మిన్ డిస్పాచ్ ద్వారా రియల్ టైమ్‌లో నవీకరించబడుతుంది" : "Updated in real-time by admin dispatch"}
                </p>
              </div>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isPullRefreshing || refreshingTracker}
              className="p-2 bg-[#e2f1e7] text-[#65a30d] hover:bg-[#d1e7da] rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title={isTe ? "నవీకరించడానికి క్లిక్ చేయండి లేదా క్రిందకు లాగండి" : "Refresh status (or pull down screen)"}
            >
              <RefreshCw size={14} className={isPullRefreshing || refreshingTracker ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isTe ? "రిఫ్రెష్" : "Refresh"}</span>
            </button>
          </div>

          {/* CANCEL SUCCESS TOAST / BANNER */}
          {cancelSuccessToast && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-xs animate-in fade-in duration-300">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{cancelSuccessToast}</span>
            </div>
          )}

          {/* ACTIVE STATUS BANNER */}
          {activeBooking.status === "Cancelled" ? (
            <div className="bg-rose-950 text-rose-100 p-4 sm:p-5 rounded-2xl shadow-md space-y-3 relative overflow-hidden border border-rose-800/80">
              <div className="flex items-center justify-between relative z-10">
                <span className="bg-rose-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  {isTe ? "రద్దు చేయబడింది" : "Cancelled"}
                </span>
                <span className="text-[10px] font-mono text-rose-300">
                  ID: {activeBooking.request_id.slice(0, 13)}...
                </span>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {isTe ? "సర్వీస్ అభ్యర్థన రద్దు చేయబడింది" : "Service Request Cancelled"}
                </h3>
                <p className="text-xs text-rose-200 font-medium">
                  {isTe 
                    ? "ఈ సర్వీస్ అభ్యర్థన రద్దు చేయబడింది. మీ వ్యక్తిగత ఫోన్ మరియు లొకేషన్ వివరాలు డేటాబేస్ నుండి శాశ్వతంగా తొలగించబడ్డాయి." 
                    : "This service request was cancelled. Customer contact & location details were permanently deleted from the database."}
                </p>
              </div>

              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-rose-600/20 rounded-full blur-xl pointer-events-none"></div>
            </div>
          ) : (
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <span className="bg-[#65a30d] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  {isTe ? "స్థితి:" : "Status:"} {activeBooking.status}
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  ID: {activeBooking.request_id.slice(0, 13)}...
                </span>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {activeBooking.status === "Pending" && (isTe ? "సిస్టమ్‌లో అభ్యర్థన నమోదు చేయబడింది" : "Request Logged in System")}
                  {activeBooking.status === "Assigned" && (isTe ? "టెక్నీషియన్ బయలుదేరారు" : "Technician Dispatched")}
                  {activeBooking.status === "In Progress" && (isTe ? "మీ చిరునామా వద్ద పని జరుగుతోంది" : "Repair Underway at Your Address")}
                  {activeBooking.status === "Completed" && (isTe ? "సేవ విజయవంతంగా పూర్తయింది" : "Service Successfully Completed")}
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  {activeBooking.status === "Pending" && (isTe ? "మా ప్రతినిధి మిమ్మల్ని త్వరలోనే సంప్రదిస్తారు" : "our agent will contact you in a while")}
                  {activeBooking.status === "Assigned" && (isTe ? "ఒక నిపుణుడైన టెక్నీషియన్ కేటాయించబడ్డారు మరియు మీ లొకేషన్‌కి బయలుదేరారు." : "An expert technician is assigned and en route to your provided landmark.")}
                  {activeBooking.status === "In Progress" && (isTe ? "టెక్నీషియన్ మీ వద్ద రిపేర్ పని చేస్తున్నారు." : "Technician is on site performing repairs. Please stand by.")}
                  {activeBooking.status === "Completed" && (isTe ? "ఫిక్స్ హోమ్ సేవలను ఉపయోగించినందుకు ధన్యవాదాలు! మీ రిపేర్ పూర్తయింది." : "Thank you for using FixHome! Your repair is finished.")}
                </p>
              </div>

              {/* Subtle visual glow */}
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[#65a30d]/20 rounded-full blur-xl pointer-events-none"></div>
            </div>
          )}

          {/* PRE-ASSIGNMENT CANCELLATION ACTION CARD */}
          {activeBooking.status === "Pending" && !activeBooking.assigned_worker_id && !activeBooking.assigned_worker_name && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 text-left space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                    <X size={18} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-rose-900 leading-tight">
                      {isTe ? "సేవను రద్దు చేయాలనుకుంటున్నారా?" : "Cancel Service Request?"}
                    </h4>
                    <p className="text-[11px] text-rose-700 font-medium truncate">
                      {isTe ? "టెక్నీషియన్ కేటాయించే వరకు రద్దు చేసుకోవచ్చు" : "Available before technician is assigned"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCancelError("");
                    setShowCancelModal(true);
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer border-none flex items-center gap-1 shrink-0"
                >
                  <X size={14} />
                  <span>{isTe ? "రద్దు చేయండి" : "Cancel"}</span>
                </button>
              </div>
              <p className="text-[10px] text-rose-600 leading-normal border-t border-rose-200/60 pt-2">
                {isTe
                  ? "🔒 రద్దు చేసిన వెంటనే మీ ఫోన్ నంబర్, చిరునామా & లొకేషన్ వివరాలు ఆటోమేటిక్‌గా తొలగించబడతాయి."
                  : "🔒 Customer phone, address & location details are permanently deleted upon cancellation."}
              </p>
            </div>
          )}

          {/* ASSIGNED SPECIALIST / WORKER DETAILS CARD */}
          {activeBooking.assigned_worker_name && (
            <div className="bg-[#e2f1e7]/80 border border-[#65a30d]/30 rounded-2xl p-4 text-left space-y-3 shadow-xs animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#65a30d] bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {isTe ? "కేటాయించబడిన టెక్నీషియన్" : "Assigned Specialist"}
                </span>
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <UserCheck size={12} className="text-[#65a30d]" /> {isTe ? "టెక్నీషియన్ వస్తున్నారు" : "Worker En Route"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={activeBooking.assigned_worker_photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"}
                  alt={activeBooking.assigned_worker_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">{activeBooking.assigned_worker_name}</h4>
                  <p className="text-xs text-slate-600 font-medium">{getLocalizedServiceType(activeBooking.service_type, currentLanguage)} {isTe ? "నిపుణుడు" : "Expert"}</p>
                  <button
                    type="button"
                    onClick={() => triggerCallWorker(undefined, activeBooking)}
                    className="text-xs text-[#65a30d] font-bold mt-0.5 inline-flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                  >
                    <Phone size={12} />
                    <span>{getWorkerDisplayPhone(activeBooking)}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => triggerCallWorker(undefined, activeBooking)}
                  className="px-3.5 py-2.5 bg-[#65a30d] hover:bg-[#52840a] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer border-none"
                >
                  <Phone size={15} />
                  <span>{isTe ? "కాల్ చేయండి" : "Call"}</span>
                </button>
              </div>
            </div>
          )}

          {/* PROGRESS STEPPER TIMELINE */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isTe ? "సేవా పురోగతి టైమ్‌లైన్" : "Dispatch Timeline & Status Steps"}
            </h4>

            <div className="relative space-y-4 before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {stages.map((stage, idx) => {
                const isPast = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const StageIcon = stage.icon;

                return (
                  <div key={stage.key} className="flex items-start gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isPast 
                        ? "bg-[#65a30d] text-white shadow-xs" 
                        : isCurrent 
                          ? "bg-[#e2f1e7] text-[#65a30d] ring-2 ring-[#65a30d] shadow-sm animate-pulse" 
                          : "bg-white text-slate-300 border border-slate-200"
                    }`}>
                      {isPast ? <Check size={18} className="stroke-[3]" /> : <StageIcon size={18} />}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between">
                        <h5 className={`text-xs font-bold ${
                          isPast || isCurrent ? "text-[#1e293b]" : "text-slate-400"
                        }`}>
                          {stage.title}
                        </h5>
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold bg-[#65a30d]/10 text-[#65a30d] px-2 py-0.5 rounded-full uppercase">
                            {isTe ? "యాక్టివ్" : "Active"}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${
                        isCurrent ? "text-slate-600 font-medium" : "text-slate-400"
                      }`}>
                        {stage.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOOKING DETAILS CARD */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
              {isTe ? "బుకింగ్ వివరాల సారాంశం" : "Booking Record Summary"}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{isTe ? "సేవ వర్గం" : "Service Type"}</span>
                <span className="font-bold text-[#1e293b]">{getLocalizedServiceType(activeBooking.service_type, currentLanguage)}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{isTe ? "సంప్రదింపు నంబర్" : "Contact Number"}</span>
                <span className={`font-semibold ${activeBooking.is_personal_data_deleted ? "text-slate-400 italic" : "text-slate-700"}`}>
                  {activeBooking.is_personal_data_deleted ? (isTe ? "తొలగించబడింది (6గం ఆటో-డిలీట్)" : "Deleted (6h Auto-Purge)") : (activeBooking.mobile_number || "Confidential")}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{isTe ? "చిరునామా" : "Physical Address"}</span>
                <span className={`font-medium leading-snug block ${activeBooking.is_personal_data_deleted ? "text-slate-400 italic" : "text-slate-700"}`}>
                  {activeBooking.is_personal_data_deleted ? (isTe ? "చిరునామా వివరాలు 6 గంటల తర్వాత ఆటోమేటిక్‌గా తొలగించబడ్డాయి" : "Location details automatically deleted after 6 hours") : (activeBooking.address || "On file")}
                </span>
              </div>

              {activeBooking.landmark && !activeBooking.is_personal_data_deleted && (
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{isTe ? "ల్యాండ్‌మార్క్" : "Landmark"}</span>
                  <span className="font-medium text-slate-600">{activeBooking.landmark}</span>
                </div>
              )}

              {activeBooking.additional_notes && !activeBooking.is_personal_data_deleted && (
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{isTe ? "అదనపు గమనికలు" : "Additional Notes"}</span>
                  <span className="font-medium text-slate-600 italic bg-slate-50 p-2 rounded-lg block border border-slate-100">
                    "{activeBooking.additional_notes}"
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECURE RETENTION INFORMATION */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex gap-2.5 items-center text-left">
            <CheckCircle2 size={16} className="text-[#65a30d] shrink-0" />
            <p className="text-[10px] text-slate-600 leading-normal">
              <strong>{isTe ? "స్వయం చాలక 6 గంటల డేటా భద్రత:" : "Auto 6-Hour Data Protection:"}</strong>{" "}
              {isTe
                ? "కస్టమర్ స్థానం మరియు ఫోన్ వివరాలు 6 గంటల తర్వాత ఆటోమేటిక్‌గా తొలగించబడతాయి. సేవా ఆధారాలు శాశ్వతంగా భద్రపరచబడతాయి."
                : "Customer location & phone details are automatically deleted after 6 hours. Service records are retained permanently."}
            </p>
          </div>

        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="pt-6 border-t border-slate-100 space-y-2 shrink-0 mt-6">
          {activeBooking.status === "Completed" ? (
            <button
              onClick={handleDismissActiveBooking}
              className="w-full py-3.5 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl font-bold shadow-md text-xs uppercase tracking-wider transition-all cursor-pointer border-none"
            >
              {isTe ? "పూర్తయింది & కొత్త సేవను బుక్ చేయండి" : "Finish & Book New Service"}
            </button>
          ) : activeBooking.status === "Cancelled" ? (
            <button
              onClick={handleDismissActiveBooking}
              className="w-full py-3.5 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl font-bold shadow-md text-xs uppercase tracking-wider transition-all cursor-pointer border-none"
            >
              {isTe ? "కొత్త సేవను బుక్ చేయండి" : "Book A New Service"}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  logNav("CustomerPortal", "Clicked View Service List button in tracker view");
                  setViewingTracker(false);
                  setBookingStep("services");
                  setSelectedCats([]);
                  setSelectedSubcategories({});
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-all cursor-pointer border-none"
              >
                {isTe ? "సేవల జాబితాను చూడండి" : "View Service List"}
              </button>
              <button
                onClick={handleDismissActiveBooking}
                className="py-3 px-4 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                {isTe ? "ట్రాకర్ క్లియర్ చేయండి" : "Clear Tracker"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CANCELLATION CONFIRMATION MODAL */}
      {showCancelModal && activeBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertCircle size={24} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {isTe ? "సర్వీస్ అభ్యర్థనను రద్దు చేయాలా?" : "Cancel Service Request?"}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  ID: #{activeBooking.request_id.slice(0, 10)}...
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldCheck size={14} className="text-amber-700 shrink-0" />
                <span>{isTe ? "తక్షణ డేటా తొలగింపు & అడ్మిన్ నోటిఫికేషన్" : "Instant PII Deletion & Admin Alert"}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/90">
                {isTe
                  ? "మీరు రద్దు చేసిన వెంటనే మీ మొబైల్ నంబర్, చిరునామా మరియు GPS లొకేషన్ వివరాలు మా డేటాబేస్ నుండి శాశ్వతంగా తొలగించబడతాయి. అలాగే అడ్మిన్ టెలిగ్రామ్‌కు తక్షణ నోటిఫికేషన్ పంపబడుతుంది."
                  : "Upon cancellation, your phone number, physical address, and GPS coordinates will be permanently and automatically deleted from the database. A cancellation alert will also be sent to the admin via Telegram."}
              </p>
            </div>

            {cancelError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2.5 rounded-xl font-medium">
                {cancelError}
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isCancellingBooking}
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer border-none"
              >
                {isTe ? "వద్దు, ఉంచండి" : "No, Keep Booking"}
              </button>
              <button
                type="button"
                disabled={isCancellingBooking}
                onClick={handleCancelBooking}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isCancellingBooking ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{isTe ? "రద్దు చేస్తోంది..." : "Cancelling..."}</span>
                  </>
                ) : (
                  <span>{isTe ? "అవును, రద్దు చేయండి" : "Yes, Cancel Request"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderFooter()}
    </>
  );
  }

  // PAGE: MY ACCOUNT, CREDENTIALS, PERMANENT HISTORY & HISTORY-BASED COUPONS
  if (customerPortalTab === "account") {
    const isTe = currentLanguage === "te";
    const couponsList = getHistoryBasedCoupons(userHistory);
    const unlockedCount = couponsList.filter(c => c.isUnlocked).length;
    const memberLevel = userHistory.length >= 3 
      ? (isTe ? "గోల్డ్ VIP హోమ్‌ఓనర్ 🥇" : "Gold VIP Homeowner 🥇") 
      : userHistory.length >= 1 
        ? (isTe ? "సిల్వర్ సభ్యుడు 🥈" : "Silver Member 🥈") 
        : (isTe ? "సాధారణ సభ్యుడు 🥉" : "Standard Member 🥉");

    return (
      <>
        <div className="flex-1 flex flex-col bg-slate-50/70 pb-16 relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {renderPullToRefreshHeader()}
        {/* PORTAL TOP BRAND HEADER */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                logNav("CustomerPortal", "Clicked Account view back button");
                setCustomerPortalTab("book");
                setBookingStep("services");
              }}
              className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
              title="Back to Services"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-slate-900">
              <img src={FIXHOME_LOGO} alt="FixHome Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-white">
              {isTe ? "ఫిక్స్ హోమ్ • నా ఖాతా" : "FixHome • My Account"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded-xl border border-slate-700">
              {memberLevel}
            </span>
          </div>
        </div>

        {/* ACCOUNT HUB MAIN BODY */}
        <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-5 max-w-2xl mx-auto w-full text-left">
          
          {/* USER PROFILE & CREDENTIALS CARD */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[#65A30D]/15 text-[#65A30D] rounded-2xl flex items-center justify-center font-bold">
                  <User size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {userNameInput || (isTe ? "ఆత్మీయ వినియోగదారు" : "Valued Customer")}
                    </h2>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                      {memberLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {t("savedCredentialsDesc", currentLanguage)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {userMobile ? (
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    📱 {userMobile}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-[#65A30D] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <User size={13} />
                    <span>{isTe ? "లాగిన్ / రిజిస్టర్" : "Login / Register"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-3.5 py-1.5 bg-[#65A30D]/10 hover:bg-[#65A30D]/20 text-[#65A30D] border border-[#65A30D]/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                  title={isTe ? "ప్రొఫైల్ సవరించండి" : "Edit Profile Details"}
                >
                  <Pencil size={14} />
                  <span>{isEditingProfile ? (isTe ? "రద్దు చేయండి" : "Cancel") : (isTe ? "ప్రొఫైల్ సవరించండి" : "Edit Profile")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUserLogout}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                  title={isTe ? "లాగ్ అవుట్" : "Logout"}
                >
                  <LogOut size={14} />
                  <span>{isTe ? "లాగ్ అవుట్" : "Logout"}</span>
                </button>
              </div>
            </div>

            {profileSaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} className="text-[#65A30D]" />
                <span>{t("profileUpdated", currentLanguage)}</span>
              </div>
            )}

            {!isEditingProfile ? (
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t("fullNameLabel", currentLanguage)}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 mt-1 block">
                      {userNameInput || (isTe ? "ఆత్మీయ వినియోగదారు" : "Valued Customer")}
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t("mobileLabel", currentLanguage)}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 mt-1 block">
                      {userPhoneInput || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#65A30D]/15 text-[#65A30D] flex items-center justify-center shrink-0">
                      <Languages size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t("selectLanguage", currentLanguage)} / భాష ఎంచుకోండి
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                        {currentLanguage === "te" ? "తెలుగు (Telugu)" : "English"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[240px] shrink-0">
                    <LanguageSelector
                      currentLanguage={currentLanguage}
                      onLanguageChange={onLanguageChange}
                      variant="pills"
                      namePrefix="account_view_lang"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90">
                <div className="sm:col-span-2 pb-1 border-b border-slate-200/80 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Pencil size={14} className="text-[#65A30D]" /> {isTe ? "ప్రొఫైల్ సమాచారాన్ని సవరించండి" : "Edit Profile Information"}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isTe ? "మీ వివరాలను క్రింద అప్‌డేట్ చేయండి" : "Update your details below"}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {t("fullNameLabel", currentLanguage)} *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      placeholder={isTe ? "ఉదా. రాజేష్ కుమార్" : "e.g., Rajesh Kumar"}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-slate-900 font-semibold focus:ring-2 focus:ring-[#65A30D] outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {t("mobileLabel", currentLanguage)} *
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="tel"
                      required
                      maxLength={15}
                      value={userPhoneInput}
                      onChange={(e) => setUserPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 15))}
                      placeholder={isTe ? "10 అంకెల మొబైల్ నంబరు" : "10-digit mobile number"}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-slate-900 font-semibold focus:ring-2 focus:ring-[#65A30D] outline-hidden"
                    />
                  </div>
                </div>

                {/* DEDICATED RADIO BUTTON LANGUAGE SELECTION BOX */}
                <div className="sm:col-span-2 p-3.5 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#65A30D]/15 text-[#65A30D] flex items-center justify-center shrink-0">
                      <Languages size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider truncate">
                        {t("selectLanguage", currentLanguage)} / భాషను ఎంచుకోండి
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {isTe ? "క్రింద ఉన్న రేడియో బటన్లను ఉపయోగించి మీ అనుకూల డిస్‌ప్లే భాషను ఎంచుకోండి." : "Select your preferred application display language using radio buttons below."}
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto sm:min-w-[280px] shrink-0">
                    <LanguageSelector
                      currentLanguage={currentLanguage}
                      onLanguageChange={onLanguageChange}
                      variant="pills"
                      namePrefix="account_credentials_lang"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isTe ? "రద్దు చేయండి" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#65A30D] hover:bg-[#52840a] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 size={15} />
                    <span>{isTe ? "ప్రొఫైల్ మార్పులను సేవ్ చేయండి" : "Save Profile Changes"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* MY UNLOCKED COUPONS & LOYALTY VOUCHERS CARD */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#65A30D]/15 text-[#65A30D] rounded-2xl flex items-center justify-center font-bold">
                  <Tag size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isTe ? "నా అన్‌లాక్ అయిన కూపన్లు & వోచర్లు" : "My Unlocked Coupons & Vouchers"}
                    </h3>
                    <span className="bg-emerald-100 text-[#65A30D] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {unlockedCount} {isTe ? "అందుబాటులో ఉన్నాయి" : "Available"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {isTe ? "మీ సేవా చరిత్ర ద్వారా పొందిన ప్రత్యేక డిస్కౌంట్లను క్లెయిమ్ చేయండి" : "Redeem special discounts unlocked through your customer account history"}
                  </p>
                </div>
              </div>

              {!userMobile && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#65A30D] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <User size={14} />
                  <span>{isTe ? "లాగిన్ / రిజిస్టర్" : "Login / Register"}</span>
                </button>
              )}
            </div>

            {couponsList.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs p-4">
                {isTe
                  ? "ప్రస్తుతానికి ఎటువంటి యాక్టివ్ కూపన్లు లేవు. నిర్వాహకులు కొత్త కూపన్‌లను విడుదల చేసినప్పుడు ఇక్కడ ప్రదర్శించబడతాయి!"
                  : "No active coupons available right now. New coupons released by the Admin will appear here!"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {couponsList.map((coupon) => (
                <div
                  key={coupon.code}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    coupon.isUnlocked
                      ? "bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200 hover:border-[#65A30D] shadow-2xs"
                      : "bg-slate-50 border-slate-200 opacity-70"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900 truncate">{coupon.title}</span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                        coupon.isUnlocked ? "bg-[#65A30D] text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {coupon.discountText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{coupon.description}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-slate-800">
                      <span>{coupon.code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(coupon.code)}
                        className="text-slate-400 hover:text-[#65A30D] ml-1 cursor-pointer"
                        title="Copy Coupon Code"
                      >
                        {copiedCode === coupon.code ? <Check size={11} className="text-[#65A30D]" /> : <Copy size={11} />}
                      </button>
                    </div>

                    {coupon.isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => handleRedeemCoupon(coupon)}
                        className="px-3 py-1 bg-[#65A30D] hover:bg-[#52840a] text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-2xs shrink-0"
                      >
                        {appliedCoupon?.code === coupon.code ? (isTe ? "వర్తించబడింది ✓" : "Applied ✓") : (isTe ? "వర్తింపజేయి" : "Apply Coupon")}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]" title={coupon.requirementText}>
                        {coupon.requirementText}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                {userMobile ? (isTe ? `లగిన్ అయ్యారు: ${userMobile}` : `Logged in as ${userMobile}`) : (isTe ? "కూపన్లను వర్తింపజేయడానికి మరియు సేవ్ చేయడానికి లాగిన్ అవ్వండి" : "Login to save and apply unlocked coupons")}
              </span>
              {!userMobile && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#65A30D] hover:bg-[#52840a] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                >
                  <User size={14} />
                  <span>{isTe ? "లాగిన్ / రిజిస్టర్" : "Login / Register"}</span>
                </button>
              )}
            </div>
          </div>

          {/* PERMANENT SERVICE BOOKING HISTORY CARD */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {t("permanentHistory", currentLanguage)}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {t("permanentHistoryDesc", currentLanguage)}
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                {userHistory.length} {isTe ? "బుకింగ్‌లు" : (userHistory.length === 1 ? "Dispatch" : "Dispatches")}
              </span>
            </div>

            {loadingHistory ? (
              <div className="space-y-2 py-4">
                {[1, 2].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : userHistory.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  {t("noHistory", currentLanguage)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isTe ? "డిస్కౌంట్ కూపన్లను పొందేందుకు మరియు చరిత్రను భద్రపరచుకోవడానికి మీ మొదటి సేవను బుక్ చేయండి!" : "Book your first service above to permanently store your dispatch records & unlock higher coupon discount tiers!"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerPortalTab("book");
                  }}
                  className="px-4 py-2 bg-[#65A30D] text-white rounded-xl text-xs font-bold mt-2 cursor-pointer shadow-xs"
                >
                  {isTe ? "ఇప్పుడే సేవను బుక్ చేయండి →" : "Book Service Now →"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {userHistory.map((h) => (
                  <div
                    key={h.request_id}
                    className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {getLocalizedServiceType(h.service_type, currentLanguage)}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                        h.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                        h.status === "Assigned" ? "bg-blue-100 text-blue-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {h.status === "Completed" ? (isTe ? "పూర్తయింది" : "Completed") :
                         h.status === "Assigned" ? (isTe ? "కేటాయించబడింది" : "Assigned") :
                         (isTe ? "పెండింగ్‌లో ఉంది" : h.status)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-1 font-medium">
                      📍 {h.address || "Address recorded"}
                    </p>

                    {h.assigned_worker_name && (
                      <div className="text-[11px] font-bold text-[#65A30D] flex items-center justify-between gap-1.5 flex-wrap pt-1">
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={13} />
                          <span>{isTe ? "టెక్నీషియన్: " : "Specialist: "}{h.assigned_worker_name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerCallWorker(undefined, h)}
                          className="px-2 py-0.5 bg-[#65a30d] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-[#52840a] cursor-pointer border-none"
                        >
                          <Phone size={10} /> {getWorkerDisplayPhone(h)}
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Request ID: {h.request_id.slice(0, 8)}... • {new Date(h.created_at).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBooking(h);
                          setViewingTracker(true);
                          setBookingStep("services");
                          setCustomerPortalTab("book");
                        }}
                        className="text-[#65A30D] font-bold hover:underline cursor-pointer text-xs"
                      >
                        {isTe ? "స్టేటస్ ట్రాక్ చేయండి →" : "Track Status →"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {renderFooter()}
    </>
  );
  }

  // PAGE 1: SERVICE SELECTION
  if (bookingStep === "services") {
    return (
      <>
        <div className="flex-1 flex flex-col bg-white pb-16 relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {renderPullToRefreshHeader()}

        {/* Sub-Header */}
        <div className="px-3.5 sm:px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-[#65a30d]/10 text-[#65a30d] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                Step 1 of 2
              </span>
              <h1 className="text-base sm:text-lg font-bold text-[#1e293b] tracking-tight truncate">{t("selectService", currentLanguage)}</h1>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">{t("selectServiceSubtitle", currentLanguage)}</p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isPullRefreshing || refreshingTracker}
              className="px-2.5 py-1.5 bg-[#e2f1e7] hover:bg-[#d1e7da] text-[#65a30d] rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer shrink-0 shadow-2xs"
              title={currentLanguage === "te" ? "నవీకరించడానికి క్లిక్ చేయండి లేదా క్రిందకు లాగండి" : "Tap or pull down screen to refresh"}
            >
              <RefreshCw size={12} className={isPullRefreshing || refreshingTracker ? "animate-spin text-[#65a30d]" : ""} />
              <span className="hidden xs:inline">{currentLanguage === "te" ? "రిఫ్రెష్" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* ADMIN MANAGED OFFERS & COUPONS HORIZONTAL SCROLL SECTION */}
        {(() => {
          const historyCoupons = getHistoryBasedCoupons(userHistory).filter((c) => !dismissedCoupons.includes(c.code));

          if (loadingOffers) {
            return (
              <div className="px-3 sm:px-5 mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[250px] sm:min-w-[320px] p-3 sm:p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 shrink-0">
                    <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2 rounded-md" />
                      <Skeleton className="h-2.5 w-3/4 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          if (historyCoupons.length === 0) return null;

          return (
            <div className="mt-3 sm:mt-4">
              <div className="px-3 sm:px-5 mb-1.5 flex items-center justify-between flex-wrap gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} className="text-[#65a30d]" /> {isTe ? "ప్రత్యేక ఆఫర్లు & కూపన్లు" : "Exclusive Offers & Coupons"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">{isTe ? "స్క్రోల్ చేయండి →" : "Scroll →"}</span>
                </div>
              </div>

              {couponMessage && (
                <div className="mx-3 sm:mx-5 mb-2 px-3 py-1.5 bg-[#e2f1e7] border border-[#65a30d]/40 rounded-xl text-xs font-bold text-[#1e293b] flex items-center justify-between">
                  <span>{couponMessage}</span>
                  <button onClick={() => setCouponMessage("")} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex gap-2.5 sm:gap-3 overflow-x-auto px-3 sm:px-5 pb-2 scrollbar-none snap-x snap-mandatory">
                {historyCoupons.map((coupon) => (
                  <div
                    key={coupon.code}
                    className={`min-w-[250px] sm:min-w-[320px] max-w-[320px] p-3 sm:p-3.5 rounded-2xl flex items-center gap-3 text-left shadow-2xs hover:shadow-md shrink-0 snap-start relative group transition-all duration-300 hover:-translate-y-0.5 border ${
                      coupon.isUnlocked
                        ? "bg-gradient-to-r from-emerald-50/90 via-[#65a30d]/10 to-emerald-50/90 border-[#65a30d]/40 hover:border-[#65a30d]"
                        : "bg-slate-50 border-slate-200/80 opacity-75"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      coupon.isUnlocked ? "bg-[#65a30d]/20 text-[#65a30d]" : "bg-slate-200 text-slate-500"
                    }`}>
                      {coupon.isUnlocked ? <Award size={18} /> : <Lock size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{coupon.title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            coupon.isUnlocked ? "bg-[#65a30d] text-white" : "bg-slate-200 text-slate-600"
                          }`}>
                            {coupon.discountText}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissCoupon(coupon.code);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                            title="Delete coupon card"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{coupon.description}</p>
                      
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-slate-800">
                          <span>{coupon.code}</span>
                        </div>
                        
                        {coupon.isUnlocked ? (
                          <button
                            onClick={() => handleRedeemCoupon(coupon)}
                            className="px-2.5 py-1 bg-[#65a30d] hover:bg-[#54870a] text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-2xs shrink-0"
                          >
                            {appliedCoupon?.code === coupon.code ? (isTe ? "వర్తించబడింది ✓" : "Applied ✓") : (isTe ? "వర్తించు" : "Apply")}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]" title={coupon.requirementText}>
                            {coupon.requirementText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ACTIVE BOOKING STICKY NOTIFICATION BAR IF BOOKING IS IN PROGRESS */}
        {activeBooking && !viewingTracker && (
          <div className="mx-3 sm:mx-5 mt-3 sm:mt-4 p-3 sm:p-3.5 bg-[#e2f1e7] border border-[#65a30d]/30 rounded-2xl flex items-center justify-between shadow-xs gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#65a30d] animate-ping absolute"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#65a30d]"></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1e293b] truncate">
                  {isTe ? "యాక్టివ్ సర్వీస్ అభ్యర్థన" : "Active Repair Request"}
                </div>
                <div className="text-[10px] text-slate-600 truncate">
                  {isTe ? "హోదా:" : "Status:"} <span className="font-extrabold text-[#65a30d]">
                    {activeBooking.status === "Completed" ? (isTe ? "పూర్తయింది" : "Completed") :
                     activeBooking.status === "Assigned" ? (isTe ? "కేటాయించబడింది" : "Assigned") :
                     (isTe ? "పెండింగ్‌లో ఉంది" : activeBooking.status)}
                  </span> ({getLocalizedServiceType(activeBooking.service_type, currentLanguage)})
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setViewingTracker(true);
                setBookingStep("services");
              }}
              className="px-3 py-1.5 bg-[#65a30d] hover:bg-[#52840a] text-white text-[10px] font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
            >
              <span>{isTe ? "ట్రాక్ చేయండి" : "Track"}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        <div className="p-3 sm:p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isTe ? "సేవా విభాగాలను ఎంచుకోండి (ఒకటి కంటే ఎక్కువ ఎంచుకోవచ్చు)" : "Select Service Categories (Multiple Allowed)"}
              </h3>
              {selectedCats.length > 0 && (
                <span className="text-[10px] text-[#65a30d] font-bold bg-[#e2f1e7] px-2 py-0.5 rounded-full border border-emerald-200">
                  {selectedCats.length} {isTe ? "సేవలు ఎంచుకోబడ్డాయి" : selectedCats.length === 1 ? "service selected" : "services selected"}
                </span>
              )}
            </div>

            {loadingCats ? (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xs space-y-0">
                    {/* Top Image Skeleton */}
                    <div className="relative w-full h-40 bg-slate-100 overflow-hidden">
                      <Skeleton className="w-full h-full rounded-none" />
                      <div className="absolute top-3 right-3">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                    </div>
                    {/* Content Skeleton */}
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4 rounded-md" />
                        <Skeleton className="h-3 w-full rounded-md" />
                        <Skeleton className="h-3 w-2/3 rounded-md" />
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
                        <Skeleton className="h-3 w-24 rounded-md" />
                        <Skeleton className="h-7 w-20 rounded-xl" />
                      </div>
                      {/* Subcategory Preview Pill Skeletons */}
                      <div className="pt-2 border-t border-slate-100 flex gap-1.5 items-center">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-16 rounded-md" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 p-4">
                <Wrench size={24} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs text-slate-500">No active categories. Contact administrator.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {categories.map((cat) => {
                  const isSelected = selectedCats.some((c) => c.id === cat.id);
                  return (
                    <div
                      key={cat.id}
                      className={`w-full text-left rounded-2xl border transition-all duration-300 cursor-pointer relative flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transform hover:-translate-y-0.5 ${
                        isSelected 
                          ? "bg-white border-[#65a30d] ring-2 ring-[#65a30d]/30 shadow-md" 
                          : "bg-white border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      {/* TOP PORTION: Service Image */}
                      <div 
                        onClick={() => toggleCategorySelection(cat)}
                        className="relative w-full h-40 overflow-hidden bg-slate-100 group shrink-0"
                      >
                        <img 
                          src={cat.image_url} 
                          alt={cat.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as any).src = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=400&auto=format&fit=crop";
                          }}
                        />
                        {isSelected && (
                          <div className="absolute top-3 right-3 bg-[#65a30d] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase shadow-md flex items-center gap-1 tracking-wider">
                            <CheckCircle2 size={12} className="stroke-[2.5]" />
                            <span>{isTe ? "ఎంచుకోబడింది" : "Selected"}</span>
                          </div>
                        )}
                      </div>

                      {/* CONTENT PORTION: Title, Description & Action */}
                      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                        {/* Title & Description */}
                        <div 
                          onClick={() => toggleCategorySelection(cat)}
                          className="space-y-1 flex-1"
                        >
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                            {getLocalizedCategoryName(cat, currentLanguage)}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {getLocalizedCategoryDesc(cat, currentLanguage)}
                          </p>
                        </div>

                        {/* Action Row: Status preview + Select Button on Right */}
                        <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
                          <div className="flex-1 min-w-0">
                            {!isSelected && cat.subcategories && cat.subcategories.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-semibold truncate block">
                                {cat.subcategories.length} {isTe ? "పనులు అందుబాటులో ఉన్నాయి" : "tasks available"}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategorySelection(cat);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0 active:scale-95 ${
                              isSelected
                                ? "bg-[#65a30d] text-white hover:bg-[#52840a] shadow-xs"
                                : "bg-slate-100 text-slate-700 hover:bg-[#65a30d] hover:text-white"
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 size={13} className="stroke-[2.5] shrink-0" />
                                <span>{isTe ? "ఎంచుకోబడింది" : "Selected"}</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} className="stroke-[2.5] shrink-0" />
                                <span>{isTe ? "+ ఎంచుకోండి" : "Select"}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* UNSELECTED SUBCATEGORIES PREVIEW TAGS */}
                        {!isSelected && cat.subcategories && cat.subcategories.length > 0 && (
                          <div 
                            onClick={() => toggleCategorySelection(cat)}
                            className="pt-2.5 border-t border-slate-100 flex flex-wrap gap-1 items-center"
                          >
                            {cat.subcategories.slice(0, 3).map((sub, sIdx) => {
                              const formatted = formatSubcategoryDisplay(sub);
                              const subItem = parseSubcategoryItem(sub);
                              const localizedSubName = getLocalizedSubcategoryName(formatted.name, currentLanguage);
                              return (
                                <span
                                  key={sIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!selectedCats.some((c) => c.id === cat.id)) {
                                      setSelectedCats((prev) => [...prev, cat]);
                                    }
                                    setSelectedSubcategories((prev) => ({
                                      ...prev,
                                      [cat.id]: [subItem]
                                    }));
                                  }}
                                  className="text-[10px] font-medium bg-slate-50 hover:bg-[#e2f1e7] text-slate-600 hover:text-[#65a30d] px-2 py-0.5 rounded-md border border-slate-200/70 flex items-center gap-1 cursor-pointer transition-colors max-w-full"
                                  title={`${isTe ? "ఎంచుకోండి" : "Select"} ${localizedSubName}`}
                                >
                                  <span className="truncate max-w-[120px]">{localizedSubName}</span>
                                </span>
                              );
                            })}
                            {cat.subcategories.length > 3 && (
                              <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md shrink-0">
                                +{cat.subcategories.length - 3} {isTe ? "మరిన్ని" : "more"}
                              </span>
                            )}
                          </div>
                        )}

                        {/* EXPANDABLE SUBCATEGORIES SECTION WITH PRICING WHEN SELECTED */}
                        {isSelected && cat.subcategories && cat.subcategories.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-emerald-200 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                            <span className="flex items-center gap-1 text-[#65a30d]">
                              <Tag size={12} />
                              {isTe ? "ఉపవిభాగాలు / ధరలతో కూడిన పనులను ఎంచుకోండి:" : "Select Sub-categories / Tasks with Prices:"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {isTe
                                  ? `${cat.subcategories.length}లో ${(selectedSubcategories[cat.id] || []).length} పనులు ఎంచుకోబడ్డాయి`
                                  : `${(selectedSubcategories[cat.id] || []).length} of ${cat.subcategories.length} tasks selected`}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentSubs = selectedSubcategories[cat.id] || [];
                                  const allSubs = (cat.subcategories || []).map(parseSubcategoryItem).filter((s) => s.name);
                                  if (currentSubs.length === allSubs.length) {
                                    setSelectedSubcategories((prev) => ({ ...prev, [cat.id]: [] }));
                                  } else {
                                    setSelectedSubcategories((prev) => ({ ...prev, [cat.id]: allSubs }));
                                  }
                                }}
                                className="text-[10px] text-[#65a30d] hover:underline font-extrabold cursor-pointer"
                              >
                                {(selectedSubcategories[cat.id] || []).length === cat.subcategories.length
                                  ? (isTe ? "అన్నీ తీసివేయండి" : "Deselect All")
                                  : (isTe ? "అన్నీ ఎంచుకోండి" : "Select All")}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {cat.subcategories.map((subRaw, sIdx) => {
                              const subItem = parseSubcategoryItem(subRaw);
                              const isSubSelected = (selectedSubcategories[cat.id] || []).some((s) => s.name === subItem.name);
                              const localizedSubName = getLocalizedSubcategoryName(subItem.name, currentLanguage);
                              return (
                                <div
                                  key={sIdx}
                                  onClick={() => toggleSubcategorySelection(cat.id, subItem)}
                                  className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                    isSubSelected
                                      ? "bg-white border-[#65a30d] text-slate-900 shadow-2xs font-semibold ring-1 ring-[#65a30d]/30"
                                      : "bg-white/60 border-slate-200/80 text-slate-600 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                      isSubSelected ? "bg-[#65a30d] border-[#65a30d] text-white" : "border-slate-300 bg-white text-transparent"
                                    }`}>
                                      <Check size={10} className="stroke-[3]" />
                                    </div>
                                    <span className="truncate text-[11px] font-medium">{localizedSubName}</span>
                                  </div>
                                  {formatSubcategoryDisplay(subItem).displayPrice && (
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                                      isSubSelected ? "bg-[#e2f1e7] text-[#65a30d]" : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {formatSubcategoryDisplay(subItem).displayPrice}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ACTION BAR ON PAGE 1 */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 shrink-0 space-y-2">
          {selectedCats.length > 0 ? (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500 text-[11px] font-medium">
                    {isTe ? "ఎంచుకున్న సేవలు & పనులు" : "Selected Services & Tasks"} ({selectedCats.length}):
                  </span>
                  <button 
                    onClick={() => {
                      setSelectedCats([]);
                      setSelectedSubcategories({});
                    }} 
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold underline cursor-pointer"
                  >
                    {isTe ? "అన్నీ క్లియర్ చేయండి" : "Clear All"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1">
                  {selectedCats.map((c) => {
                    const subs = selectedSubcategories[c.id] || [];
                    const localizedCatName = getLocalizedCategoryName(c, currentLanguage);
                    return (
                      <span 
                        key={c.id} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e2f1e7] text-[#1e293b] border border-emerald-200 text-[10px] font-bold rounded-lg"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#65a30d]"></span>
                        <span>{localizedCatName}</span>
                        {subs.length > 0 && (
                          <span className="text-[9px] bg-[#65a30d] text-white px-1.5 py-0.2 rounded font-mono">
                            {subs.length} {isTe ? "పనులు" : subs.length === 1 ? "task" : "tasks"}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Pricing Disclaimer */}
              <div className="p-3.5 bg-amber-50/95 border border-amber-200/90 rounded-xl flex items-start gap-3 text-amber-950 shadow-xs">
                <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm sm:text-[15px] leading-relaxed font-medium">
                  <span className="font-bold text-amber-900">{isTe ? "గమనిక: " : "Disclaimer: "}</span>
                  {isTe 
                    ? "ఇక్కడ పేర్కొన్న ధరలు సర్వీస్ చార్జీలకు మాత్రమే. విడిభాగాలు లేదా పరికరాల (equipment/materials) ఖర్చులు ఇందులో చేర్చబడవు." 
                    : "The prices mentioned are only for the service and not for the equipment or spare parts."}
                </p>
              </div>

              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                    {isTe ? "మొత్తం అంచనా వ్యయం" : "Estimated Total"}
                  </span>
                  {(() => {
                    const { minTotal, maxTotal } = getCalculatedSubtotalRange();
                    return (
                      <span className="text-sm font-extrabold text-[#65a30d]">
                        {formatPriceVal(minTotal, maxTotal)}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => {
                    setBookingStep("details");
                  }}
                  className="py-2.5 px-5 bg-[#65a30d] hover:bg-[#52840a] text-white rounded-xl font-bold shadow-md text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <span>{isTe ? "స్థిరీకరించండి & వివరాలు నింపండి" : "Confirm & Fill Details"}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
              <p className="text-xs text-slate-400 font-medium">
                {isTe
                  ? "ధరలతో కూడిన పనులను ఎంచుకోవడానికి పైన ఉన్న ఒకటి లేదా అంతకంటే ఎక్కువ సేవా విభాగాలను ట్యాప్ చేయండి"
                  : "Please tap one or more service categories above to select tasks with pricing"}
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span className="font-mono">v4.0.0 • FixHome</span>
            <button
              type="button"
              onClick={() => {
                setViewingFullPrivacy(true);
              }}
              className="font-bold text-[#65a30d] hover:underline"
            >
              {isTe ? "గోప్యతా విధానం" : "Privacy Policy"}
            </button>
          </div>
        </div>
      </div>
      {renderFooter()}
    </>
  );
  }

  // PAGE 2: FILL REQUIRED DETAILS
  return (
    <>
      <div className="flex-1 flex flex-col bg-white pb-16 relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {renderPullToRefreshHeader()}
      {/* Sub-Header Page 2 */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              logNav("CustomerPortal", "Clicked Back button in booking details step");
              setBookingStep("services");
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
            title={isTe ? "సేవా విభాగాలకు తిరిగి వెళ్లండి" : "Back to service categories"}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{isTe ? "వెనుకకు" : "Back"}</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#65a30d]/10 text-[#65a30d] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                {isTe ? "దశ 2 / 2" : "Step 2 of 2"}
              </span>
              <h1 className="text-base font-bold text-[#1e293b] tracking-tight">
                {isTe ? "బుకింగ్ అవసరమైన వివరాలు" : "Required Booking Details"}
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {isTe ? "స్థిరీకరించడానికి ఫోన్ నంబర్ & లొకేషన్ అందించండి" : "Provide phone & dispatch location to confirm"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e2f1e7] rounded-full border border-emerald-100 shrink-0">
          <Clock size={11} className="text-[#65a30d]" />
          <span className="text-[9px] font-bold text-[#65a30d] uppercase">{isTe ? "6గం క్లియరింగ్" : "6h Purge"}</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto">
        {/* SELECTED CATEGORY SUMMARY BANNER */}
        {selectedCats.length > 0 && (
          <div className="p-3.5 bg-[#e2f1e7] border border-[#65a30d]/30 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#65a30d]"></span>
                <span className="text-[10px] font-extrabold text-[#65a30d] uppercase tracking-wider">
                  {isTe ? "ఎంచుకున్న సేవలు" : "Selected Services"} ({selectedCats.length})
                </span>
              </div>
              <button
                onClick={() => {
                  logNav("CustomerPortal", "Clicked Edit Services button in booking details step");
                  setBookingStep("services");
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-[#65a30d] bg-white hover:bg-emerald-50 rounded-lg border border-emerald-200 shrink-0 transition-colors cursor-pointer"
              >
                {isTe ? "సేవలను సవరించండి" : "Edit Services"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedCats.map((cat) => {
                const subs = selectedSubcategories[cat.id] || [];
                const localizedCatName = getLocalizedCategoryName(cat, currentLanguage);
                const localizedCatDesc = getLocalizedCategoryDesc(cat, currentLanguage);
                return (
                  <div key={cat.id} className="p-2.5 bg-white rounded-xl border border-emerald-100 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={cat.image_url} 
                        alt={cat.name} 
                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=200&auto=format&fit=crop";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-[#1e293b] truncate">{localizedCatName}</h4>
                        <p className="text-[9px] text-slate-400 line-clamp-1">{localizedCatDesc}</p>
                      </div>
                    </div>
                    {subs.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                        {subs.map((s, sIdx) => {
                          const formatted = formatSubcategoryDisplay(s);
                          const localizedSubName = getLocalizedSubcategoryName(formatted.name, currentLanguage);
                          return (
                            <span key={sIdx} className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200/80 flex items-center gap-1 font-medium">
                              <span>{localizedSubName}</span>
                              {formatted.displayPrice && <span className="font-bold text-[#65a30d]">{formatted.displayPrice}</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GPS MAP CONTROLLER */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl overflow-hidden p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#e2f1e7] text-[#65a30d] rounded-2xl flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                <MapPin size={24} className="stroke-[2.5]" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h4 className="text-base sm:text-lg font-black text-[#1e293b] leading-tight">
                  {isTe ? "జీపీఎస్ లొకేషన్" : "GPS Dispatch Overlay"}
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-snug">
                  {isTe ? "శాటిలైట్ కోఆర్డినేట్లను లాక్ చేస్తుంది" : "Locks satellite coordinates for technician arrival"}
                </p>
              </div>
            </div>

            {/* INCREASED SIZE AND WIDTH LOCATE ME BUTTON */}
            <button
              id="locate-me-btn"
              type="button"
              onClick={triggerGpsPrompt}
              disabled={locating}
              className={`w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-4 min-h-[52px] sm:min-h-[56px] min-w-full sm:min-w-[220px] font-black text-base sm:text-lg rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer flex items-center justify-center gap-2.5 shrink-0 ${
                locating
                  ? "bg-slate-800 text-white cursor-wait opacity-90"
                  : coords
                  ? "bg-[#e2f1e7] hover:bg-[#d2e8db] text-[#52840a] border-2 border-[#65a30d]"
                  : "bg-[#65a30d] hover:bg-[#52840a] text-white"
              }`}
            >
              {locating ? (
                <>
                  <Compass size={22} className="animate-spin text-[#65a30d]" />
                  <span>{isTe ? "గుర్తిస్తోంది..." : "Locating..."}</span>
                </>
              ) : coords ? (
                <>
                  <CheckCircle2 size={22} className="text-[#65a30d] stroke-[2.5]" />
                  <span>{isTe ? "లొకేషన్ గుర్తించబడింది ✓" : "Locate Me"}</span>
                </>
              ) : (
                <>
                  <MapPin size={22} className="stroke-[2.5]" />
                  <span>{isTe ? "లొకేట్ చేయండి" : "Locate Me"}</span>
                </>
              )}
            </button>
          </div>

          {/* Status or Coordinate feedback */}
          {gpsStatusText && (
            <div className={`text-xs p-2.5 rounded-xl border flex gap-2 items-center ${
              gpsPermissionGranted === false 
                ? "bg-[#fff1f2] text-rose-700 border-rose-200" 
                : "bg-[#e2f1e7] text-emerald-900 border-emerald-200 font-medium"
            }`}>
              <Info size={14} className="shrink-0 text-[#65a30d]" />
              <span className="truncate font-semibold">{gpsStatusText}</span>
            </div>
          )}

          {/* Map Illustration */}
          <div className="relative h-40 sm:h-44 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs">
            {locating ? (
              <div className="relative w-full h-full bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 rounded-full border border-emerald-500/30 animate-ping"></div>
                  <div className="w-20 h-20 rounded-full border border-emerald-500/50 animate-pulse"></div>
                </div>
                <div className="relative z-10 flex flex-col items-center space-y-2">
                  <Compass size={28} className="animate-spin text-[#65a30d]" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#65a30d] animate-ping"></span>
                      {isTe ? "జీపీఎస్ శాటిలైట్ సిగ్నల్‌ను లాక్ చేస్తోంది..." : "Locking GPS Satellite Signal..."}
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <Skeleton className="h-2 w-12 bg-slate-700/80 rounded" />
                      <Skeleton className="h-2 w-16 bg-slate-700/80 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ) : coords ? (
              <div className="relative w-full h-full">
                <iframe
                  title="Customer GPS Location Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.003}%2C${coords.lat - 0.003}%2C${coords.lng + 0.003}%2C${coords.lat + 0.003}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                  className="w-full h-full rounded-xl border-0 pointer-events-auto"
                />
                <div className="absolute top-2 right-2 bg-slate-900/85 text-white text-[9px] font-mono font-bold px-2 py-1 rounded-md shadow-md backdrop-blur-xs flex items-center gap-1.5 pointer-events-none">
                  <MapPin size={11} className="text-rose-400" />
                  <span>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 gap-1.5 p-4 text-center">
                <Compass size={24} className="animate-spin-slow text-slate-400" />
                <span className="text-xs font-medium leading-snug text-slate-500">
                  {isTe ? 'పైన ఉన్న "లొకేట్ చేయండి" బటన్ నొక్కండి లేదా మీ చిరునామాను క్రింద నమోదు చేయండి.' : 'Tap "Locate Me" above or type explicit address below to view location on map.'}
                </span>
              </div>
            )}
            
            <div className="absolute bottom-1 right-2 text-[8px] font-mono font-bold text-slate-500/80 bg-white/70 px-1 rounded pointer-events-none select-none">
              FixHome Maps
            </div>
          </div>
        </div>

        {/* BOOKING DETAILS FORM */}
        <form onSubmit={handleBookingSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isTe ? "కస్టమర్ మొబైల్ ఫోన్ (10 అంకెలు)" : "Customer Mobile Phone (10 Digits)"} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="tel"
                required
                maxLength={15}
                placeholder={isTe ? "10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి" : "Enter 10-digit mobile number"}
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
                  setPhone(digits);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              {phone.length > 0 && phone.length < 10 ? (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle size={10} /> {isTe ? "మొబైల్ నంబర్ చెల్లదు" : "Phone number is invalid"}
                </p>
              ) : phone.length === 10 ? (
                <p className="text-[10px] text-[#65a30d] font-bold flex items-center gap-1">
                  <CheckCircle2 size={10} /> {isTe ? "సరైన 10 అంకెల నంబర్" : "Valid 10-digit number"}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium">
                  {isTe ? "ఖచ్చితంగా 10 అంకెలు ఉండాలి" : "Must be exactly 10 digits"}
                </p>
              )}
              <p className={`text-[10px] font-bold ${phone.length === 10 ? "text-[#65a30d]" : phone.length > 0 ? "text-rose-500" : "text-slate-400"}`}>
                {phone.length}/10 {isTe ? "అంకెలు" : "digits"}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {isTe ? "ఖచ్చితమైన సర్వీస్ చిరునామా" : "Explicit Dispatch Address"} <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={triggerGpsPrompt}
                disabled={locating}
                className="text-[10px] font-extrabold text-[#65a30d] hover:text-[#52840a] flex items-center gap-1 bg-[#e2f1e7] hover:bg-[#d2e8db] px-2.5 py-0.5 rounded-lg cursor-pointer transition-colors border border-emerald-200 shadow-2xs"
                title={isTe ? "ప్రస్తుత పరికర GPS స్థానం నుండి చిరునామాను ఆటో-ఫిల్ చేయండి" : "Auto-fill address from current device GPS position"}
              >
                <Compass size={11} className={locating ? "animate-spin text-[#65a30d]" : "text-[#65a30d]"} />
                <span>{locating ? (isTe ? "గుర్తిస్తోంది..." : "Locating...") : (isTe ? "జీపీఎస్ ఆటో-ఫిల్" : "📍 GPS Auto-Fill")}</span>
              </button>
            </div>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                required
                rows={2}
                placeholder={isTe ? "పూర్తి భౌతిక చిరునామాను నమోదు చేయండి (ఉదా. వీధి, ఇంటి నం, ప్రాంతం)" : "Provide detailed physical address (e.g. Street, House No., Area)"}
                value={address}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddress(val);
                  if (val.trim().length >= 4) {
                    geocodeManualAddress(val);
                  }
                }}
                onBlur={() => {
                  if (address.trim().length >= 3) {
                    geocodeManualAddress(address);
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-relaxed"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isTe ? "ల్యాండ్‌మార్క్" : "Landmark"} <span className="text-slate-400">({isTe ? "ఐచ్ఛికం" : "Optional"})</span>
            </label>
            <div className="relative">
              <Building size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={isTe ? "ఉదా. సిటీ చర్చ్ లేదా ప్రధాన ఆలయం దగ్గర" : "E.g., Near City Church"}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isTe ? "అదనపు గమనికలు / లోపాల వివరాలు" : "Additional Notes / Defect Details"} <span className="text-slate-400">({isTe ? "ఐచ్ఛికం" : "Optional"})</span>
            </label>
            <textarea
              rows={2}
              placeholder={isTe ? "అదనపు గమనికలు లేదా సూచనలను నమోదు చేయండి..." : "Provide any additional notes or instructions..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#1e293b] focus:bg-white focus:ring-1 focus:ring-[#65a30d] outline-hidden font-medium leading-relaxed"
            />
          </div>

          {isSubmitting && (
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#65a30d] animate-ping"></span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {isTe ? "సేవా అభ్యర్థన పంపబడుతోంది..." : "Dispatching Service Request..."}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#65a30d] font-bold bg-[#65a30d]/20 px-2 py-0.5 rounded-md">
                  {isTe ? "ప్రాసెసింగ్" : "Processing"}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span className="flex items-center gap-1 font-medium">
                    <Activity size={12} className="text-[#65a30d] animate-spin" />
                    {isTe ? "FixHome డిస్పాచ్ ఇంజిన్‌కు కనెక్ట్ అవుతోంది..." : "Connecting to FixHome Dispatch Engine..."}
                  </span>
                  <span className="font-bold">100%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#65a30d] h-full rounded-full w-full animate-pulse"></div>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3 w-20 bg-slate-800 rounded" />
                  <Skeleton className="h-3 w-14 bg-slate-800 rounded" />
                </div>
                <span className="text-[9px] text-slate-400 italic">
                  {isTe ? "దయచేసి వేచి ఉండండి, తక్షణమే డిస్పాచ్ చేయబడుతుంది..." : "Please wait standard instant dispatch..."}
                </span>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-[#fff1f2] border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Pricing Disclaimer */}
          <div className="p-4 bg-amber-50/95 border border-amber-200/90 rounded-xl flex items-start gap-3 text-amber-950 shadow-xs">
            <Info size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm sm:text-[15.5px] leading-relaxed font-medium">
              <span className="font-bold text-amber-900">{isTe ? "గమనిక: " : "Disclaimer: "}</span>
              {isTe 
                ? "ఇక్కడ పేర్కొన్న ధరలు సర్వీస్ చార్జీలకు మాత్రమే. విడిభాగాలు లేదా పరికరాల (materials/equipment) ఖర్చులు ఇందులో చేర్చబడవు." 
                : "The prices mentioned are only for the service and not for the equipment or spare parts."}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#65a30d] hover:bg-[#52840a] disabled:bg-[#65a30d]/70 text-white rounded-xl font-bold shadow-md text-xs tracking-wider uppercase active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-white" />
                  <span>{isTe ? "టెక్నీషియన్‌ను డిస్పాచ్ చేస్తోంది & ID లాక్ చేస్తోంది..." : "Dispatching Technician & Locking ID..."}</span>
                </>
              ) : (
                isTe
                  ? `${selectedCats.length} సేవల బుకింగ్‌ను నిర్ధారించి సమర్పించండి`
                  : `Confirm & Submit ${selectedCats.length} ${selectedCats.length === 1 ? "Service" : "Services"} Booking`
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer link to Privacy Policy */}
      <div className="py-3 px-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
        <span className="text-[10px] text-slate-400 font-mono">v4.0.0 • FixHome</span>
        <button
          type="button"
          onClick={() => {
            setViewingFullPrivacy(true);
          }}
          className="text-[10px] font-bold text-[#65a30d] hover:underline"
        >
          {isTe ? "గోప్యతా విధానం" : "Privacy Policy"}
        </button>
      </div>
      </div>

      {renderFooter()}

      {/* GPS Warning Pre-permission Info Dialog */}
      {gpsModalOpen && (
        <div className="absolute inset-0 bg-[#1e293b]/70 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 text-center space-y-4 max-w-[310px] shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-[#e2f1e7] text-[#65a30d] rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Compass size={24} className="animate-spin-slow stroke-[2]" />
            </div>
            
            <h3 className="text-base font-bold text-[#1e293b] tracking-tight">
              {isTe ? "ముందస్తు లొకేషన్ అనుమతి" : "Pre-Permission Location Check"}
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-normal">
              {isTe ? (
                <><strong>FixHome</strong> టెక్నీషియన్‌ను పంపడానికి మీ ఖచ్చితమైన భౌగోళిక కోఆర్డినేట్లను కోరుతుంది.</>
              ) : (
                <><strong>FixHome</strong> requires your exact geolocation coordinates to pinpoint dispatch technicians.</>
              )}
            </p>
            <p className="text-[10px] text-slate-400 leading-normal bg-slate-50 p-2 rounded-lg border">
              {isTe ? (
                <>డిస్పాచ్ ఖచ్చితత్వం కోసం మేము <strong>ముందుభాగంలో మాత్రమే</strong> GPS కోఆర్డినేట్లను సేకరిస్తాము. బ్యాక్‌గ్రౌండ్ ట్రాకింగ్ ఉండదు.</>
              ) : (
                <>We gather GPS coordinates <strong>solely in the foreground</strong> for dispatch accuracy. No background tracking is active.</>
              )}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  logNav("CustomerPortal", "Clicked Type Manually in GPS modal");
                  setGpsModalOpen(false);
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-[#1e293b] text-xs font-bold rounded-xl transition-all"
              >
                {isTe ? "మాన్యువల్‌గా నమోదు చేయండి" : "Type Manually"}
              </button>
              <button
                onClick={handleConfirmGpsPermission}
                className="flex-1 py-2 bg-[#65a30d] hover:bg-[#52840a] text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                {isTe ? "GPS అనుమతించండి" : "Allow GPS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE LOGIN & HISTORY MODAL */}
      {historyModalOpen && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 text-left space-y-4 w-full max-w-sm shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#e2f1e7] text-[#65a30d] rounded-xl flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {userMobile
                      ? (isTe ? "నా ఖాతా & బుకింగ్ చరిత్ర" : "My Account & History")
                      : (isTe ? "మొబైల్ లాగిన్ / చరిత్ర" : "Mobile Login / History")}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {userMobile
                      ? (isTe ? `${userMobile} గా లాగిన్ అయ్యారు` : `Logged in as ${userMobile}`)
                      : (isTe ? "మునుపటి బుకింగ్‌లను చూడటానికి మొబైల్ నంబర్ నమోదు చేయండి" : "Enter mobile number to retrieve past bookings")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  logNav("CustomerPortal", "Clicked Close button in History modal");
                  setHistoryModalOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            {!userMobile ? (
              <div className="space-y-4">
                {/* Auth Mode Toggle Tabs */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-center">
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      authMode === "login"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {isTe ? "యూజర్ లాగిన్" : "User Login"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("register"); setAuthError(""); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      authMode === "register"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {isTe ? "ఖాతా నమోదు" : "Register Account"}
                  </button>
                </div>

                {authError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="font-medium">{authError}</span>
                  </div>
                )}

                {authMode === "login" ? (
                  <form onSubmit={handleUserMobileLogin} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isTe ? "మొబైల్ ఫోన్ నంబర్ *" : "Mobile Phone Number *"}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder={isTe ? "10 అంకెల మొబైల్ నంబర్" : "10-digit mobile number"}
                        value={loginPhoneInput}
                        onChange={(e) => setLoginPhoneInput(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isTe ? "ఖాతా పాస్‌వర్డ్ *" : "Account Password *"}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder={isTe ? "పాస్‌వర్డ్ నమోదు చేయండి" : "Enter your password"}
                          value={loginPasswordInput}
                          onChange={(e) => setLoginPasswordInput(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-9 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-[#65a30d] hover:bg-[#52840a] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {authLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                      <span>{isTe ? "లాగిన్ అవ్వండి & ప్రొఫైల్ చూడండి" : "Login & Access Profile"}</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleUserRegister} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isTe ? "పూర్తి పేరు *" : "Full Name *"}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={isTe ? "ఉదా. రాజేష్ కుమార్" : "E.g., Rajesh Kumar"}
                        value={registerNameInput}
                        onChange={(e) => setRegisterNameInput(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isTe ? "మొబైల్ ఫోన్ నంబర్ *" : "Mobile Phone Number *"}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder={isTe ? "10 అంకెల మొబైల్ నంబర్" : "10-digit mobile number"}
                        value={registerPhoneInput}
                        onChange={(e) => setRegisterPhoneInput(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isTe ? "ఖాతా పాస్‌వర్డ్ సృష్టించండి *" : "Create Account Password *"}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={4}
                          placeholder={isTe ? "కనీసం 4 అక్షరాలు" : "At least 4 characters"}
                          value={registerPasswordInput}
                          onChange={(e) => setRegisterPasswordInput(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-9 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#65a30d] outline-hidden font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-[#65a30d] hover:bg-[#52840a] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {authLoading ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      <span>{isTe ? "ఖాతా సృష్టించండి & నమోదు చేయండి" : "Create Account & Register"}</span>
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px]">
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-800">{isTe ? "ఫోన్" : "Phone"}: {userMobile}</span>
                  <button
                    onClick={handleUserLogout}
                    className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut size={10} />
                    <span>{isTe ? "నంబర్ మార్చండి" : "Change Number"}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {isTe ? "గత & క్రియాశీల బుకింగ్‌లు" : "Past & Active Dispatches"} ({userHistory.length})
                  </h4>

                  {loadingHistory ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <Skeleton className="h-3.5 w-1/3 rounded" />
                            <Skeleton className="h-3 w-16 rounded-full" />
                          </div>
                          <Skeleton className="h-2.5 w-1/2 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : userHistory.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl text-slate-400 text-xs p-3">
                      {isTe
                        ? `${userMobile} కోసం గత బుకింగ్‌లు ఏవీ కనుగొనబడలేదు.`
                        : `No prior booking dispatches found for ${userMobile}.`}
                    </div>
                  ) : (
                    userHistory.map((h) => (
                      <div
                        key={h.request_id}
                        className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{getLocalizedServiceType(h.service_type, currentLanguage)}</span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            h.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                            h.status === "Assigned" ? "bg-blue-100 text-blue-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {h.status === "Completed" ? (isTe ? "పూర్తయింది" : "Completed") :
                             h.status === "Assigned" ? (isTe ? "కేటాయించబడింది" : "Assigned") :
                             (isTe ? "పెండింగ్‌లో ఉంది" : h.status)}
                          </span>
                        </div>

                        {h.assigned_worker_name && (
                          <div className="text-[10px] font-medium text-[#65a30d] flex items-center gap-1">
                            <UserCheck size={11} />
                            <span>{isTe ? "టెక్నీషియన్" : "Worker"}: {h.assigned_worker_name}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>{new Date(h.created_at).toLocaleDateString()}</span>
                          <button
                            onClick={() => {
                              setActiveBooking(h);
                              setViewingTracker(true);
                              setBookingStep("services");
                              setHistoryModalOpen(false);
                            }}
                            className="text-[#65a30d] font-bold hover:underline cursor-pointer"
                          >
                            {isTe ? "లైవ్ ట్రాక్ →" : "Track Live →"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
