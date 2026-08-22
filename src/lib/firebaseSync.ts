import { doc, collection, setDoc, onSnapshot, getDoc, getDocs } from "firebase/firestore";
import { db, auth } from "./firebase.ts";
import { Category, Offer, Worker, Booking } from "../types.ts";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnavailable = errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("Could not reach Cloud Firestore");

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null
    },
    operationType,
    path
  };

  if (isOfflineOrUnavailable) {
    console.warn("[Firestore Offline/Fallback Mode] Operating locally until connection recovers:", JSON.stringify(errInfo));
  } else {
    console.error("Firestore Error: ", JSON.stringify(errInfo));
  }
}

/**
 * Emit a global real-time admin signal to notify all connected devices worldwide
 */
export async function emitGlobalAdminSignal(actionName: string) {
  const path = "app_sync/global_signal";
  try {
    await setDoc(doc(db, "app_sync", "global_signal"), {
      updatedAt: new Date().toISOString(),
      action: actionName
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync active Categories list to Firestore for instant multi-device sync
 */
export async function syncCategoriesToFirestore(categories: Category[]) {
  const path = "app_sync/categories";
  try {
    await setDoc(doc(db, "app_sync", "categories"), {
      data: categories,
      updatedAt: new Date().toISOString()
    });
    await emitGlobalAdminSignal("CATEGORIES_UPDATED");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync active Offers list to Firestore for instant multi-device sync
 */
export async function syncOffersToFirestore(offers: Offer[]) {
  const path = "app_sync/offers";
  try {
    await setDoc(doc(db, "app_sync", "offers"), {
      data: offers,
      updatedAt: new Date().toISOString()
    });
    await emitGlobalAdminSignal("OFFERS_UPDATED");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync Workers list to Firestore for instant multi-device sync
 */
export async function syncWorkersToFirestore(workers: Worker[]) {
  const path = "app_sync/workers";
  try {
    await setDoc(doc(db, "app_sync", "workers"), {
      data: workers,
      updatedAt: new Date().toISOString()
    });
    await emitGlobalAdminSignal("WORKERS_UPDATED");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Sync individual Booking to Firestore
 */
export async function syncBookingToFirestore(booking: Booking) {
  if (!booking || !booking.request_id) return;
  const path = `bookings/${booking.request_id}`;
  try {
    await setDoc(doc(db, "bookings", booking.request_id), {
      ...booking,
      updatedAtFirestore: new Date().toISOString()
    }, { merge: true });
    await emitGlobalAdminSignal("BOOKING_UPDATED");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Real-time listener for Categories
 */
export function subscribeCategoriesRealtime(onUpdate: (categories: Category[]) => void) {
  const path = "app_sync/categories";
  return onSnapshot(doc(db, "app_sync", "categories"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && Array.isArray(data.data)) {
        onUpdate(data.data);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Real-time listener for Offers
 */
export function subscribeOffersRealtime(onUpdate: (offers: Offer[]) => void) {
  const path = "app_sync/offers";
  return onSnapshot(doc(db, "app_sync", "offers"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && Array.isArray(data.data)) {
        onUpdate(data.data);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Real-time listener for Workers
 */
export function subscribeWorkersRealtime(onUpdate: (workers: Worker[]) => void) {
  const path = "app_sync/workers";
  return onSnapshot(doc(db, "app_sync", "workers"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && Array.isArray(data.data)) {
        onUpdate(data.data);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Real-time listener for Global Signal
 */
export function subscribeGlobalSignalRealtime(onSignal: (action: string) => void) {
  const path = "app_sync/global_signal";
  return onSnapshot(doc(db, "app_sync", "global_signal"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && data.action) {
        onSignal(data.action);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Real-time listener for Single Booking Status Tracker
 */
export function subscribeBookingRealtime(bookingId: string, onUpdate: (booking: Booking) => void) {
  if (!bookingId) return () => {};
  const path = `bookings/${bookingId}`;
  return onSnapshot(doc(db, "bookings", bookingId), (snapshot) => {
    if (snapshot.exists()) {
      const booking = snapshot.data() as Booking;
      if (booking) {
        onUpdate(booking);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Real-time listener for All Bookings (Admin Portal)
 */
export function subscribeAllBookingsRealtime(onUpdate: (bookings: Booking[]) => void) {
  const path = "bookings";
  return onSnapshot(collection(db, "bookings"), (snapshot) => {
    const list: Booking[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as Booking;
      if (item && item.request_id) {
        list.push(item);
      }
    });
    if (list.length > 0) {
      onUpdate(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Direct client query for user booking history from Firestore
 */
export async function fetchUserBookingsFromFirestore(mobileNumber: string): Promise<Booking[]> {
  if (!mobileNumber || !mobileNumber.trim()) return [];
  const cleanDigits = mobileNumber.replace(/\D/g, "");
  const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

  try {
    const snapshot = await getDocs(collection(db, "bookings"));
    const results: Booking[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Booking;
      if (!data || !data.request_id) return;
      const bPhone = (data.mobile_number || "").replace(/\D/g, "");
      const cPhone = (data.customer_user_phone || "").replace(/\D/g, "");
      if (
        (bPhone && (bPhone.includes(last10) || last10.includes(bPhone))) ||
        (cPhone && (cPhone.includes(last10) || last10.includes(cPhone)))
      ) {
        results.push(data);
      }
    });
    return results;
  } catch (err) {
    return [];
  }
}


