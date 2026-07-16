import React from "react";
import { Shield, Mail, Globe, Clock, ChevronLeft } from "lucide-react";

interface PrivacyPolicyProps {
  onBack?: () => void;
  showBackHeader?: boolean;
}

export default function PrivacyPolicy({ onBack, showBackHeader = false }: PrivacyPolicyProps) {
  return (
    <div id="privacy-policy-view" className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Optional header with back action */}
      {showBackHeader && onBack && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-white sticky top-0 z-10">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
            title="Go Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Privacy Policy</h2>
            <p className="text-[10px] text-slate-400">Effective Date: 15 July 2026</p>
          </div>
        </div>
      )}

      {/* Main text content container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-left select-text">
        {!showBackHeader && (
          <div className="border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 bg-[#e2f1e7] text-[#65a30d] rounded-lg flex items-center justify-center">
                <Shield size={18} className="stroke-[2.5]" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
            </div>
            <p className="text-xs text-slate-400 font-medium font-mono">Effective Date: 15 July 2026</p>
          </div>
        )}

        {/* Intro */}
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Welcome to <strong className="text-slate-800">Fix home</strong>. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains what information we collect and how we use it when you use the Fix home application.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            By using Fix home, you agree to the practices described in this Privacy Policy.
          </p>
        </div>

        {/* Information We Collect */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Information We Collect
          </h2>
          
          <div className="space-y-3 pl-2">
            <div>
              <h3 className="text-xs font-bold text-slate-700">Contact Number</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                We collect your mobile phone number to:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-600 mt-1 pl-2 space-y-1">
                <li>Create and manage your account.</li>
                <li>Contact you regarding your service requests.</li>
                <li>Verify your identity when necessary.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700">Location Information</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                With your permission, Fix home collects your device's location to:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-600 mt-1 pl-2 space-y-1">
                <li>Identify your service location.</li>
                <li>Connect you with nearby service providers.</li>
                <li>Improve the accuracy of our services.</li>
              </ul>
              <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">
                Location access is requested only with your consent, and you can disable it at any time through your device settings.
              </p>
            </div>
          </div>
        </div>

        {/* How We Use Your Information */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            How We Use Your Information
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We use your information to:
          </p>
          <ul className="list-disc list-inside text-xs text-slate-600 pl-4 space-y-1">
            <li>Provide home service bookings.</li>
            <li>Match you with nearby service providers.</li>
            <li>Communicate about your service requests.</li>
            <li>Improve our services.</li>
          </ul>
        </div>

        {/* Information Sharing */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Information Sharing
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We do not sell or rent your personal information.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We may share your location and contact number only with the service provider assigned to your booking so they can complete the requested service. We may also disclose information if required by law.
          </p>
        </div>

        {/* Data Security */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Data Security
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We take reasonable measures to protect your information from unauthorized access, loss, misuse, or disclosure.
          </p>
        </div>

        {/* Data Retention */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Data Retention
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We retain your information only for as long as necessary to provide our services or to comply with legal obligations.
          </p>
        </div>

        {/* Your Rights */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Your Rights
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            You may:
          </p>
          <ul className="list-disc list-inside text-xs text-slate-600 pl-4 space-y-1">
            <li>Request deletion of your account and associated information.</li>
            <li>Withdraw location permission at any time through your device settings.</li>
          </ul>
        </div>

        {/* Children's Privacy */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Children's Privacy
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            Fix home is not intended for children under the age of 13. We do not knowingly collect personal information from children.
          </p>
        </div>

        {/* Changes to This Privacy Policy */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-l-2 border-[#65a30d] pl-2">
            Changes to This Privacy Policy
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed pl-2">
            We may update this Privacy Policy from time to time. Any changes will be posted within the application. Continued use of the app after changes means you accept the updated Privacy Policy.
          </p>
        </div>

        {/* Contact Us */}
        <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Mail size={14} className="text-[#65a30d]" />
            <span>Contact Us</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <div className="text-xs text-slate-700 font-medium space-y-1 pl-1">
            <p className="font-semibold">Fix home Support</p>
            <p className="flex items-center gap-1">
              <span className="text-slate-400">Email:</span> 
              <a href="mailto:teamtaurus2026@gmail.com" className="text-[#65a30d] hover:underline">
                teamtaurus2026@gmail.com
              </a>
            </p>
            <p className="flex items-center gap-1">
              <Globe size={11} className="text-slate-400 shrink-0" />
              <span className="text-slate-400">Website:</span> 
              <a href="https://taurus-helpdesk.ai.studio" target="_blank" rel="noopener noreferrer" className="text-[#65a30d] hover:underline flex items-center gap-0.5">
                https://taurus-helpdesk.ai.studio
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
