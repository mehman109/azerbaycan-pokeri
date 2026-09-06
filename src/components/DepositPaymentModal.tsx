import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Copy, 
  Check, 
  Upload, 
  FileCheck, 
  Trash2, 
  X, 
  ArrowDownRight, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import { verifyDepositReceipt, logFraudAttempt, markReceiptAsUsed } from '../services/receiptVerifier';

interface DepositPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositAmount: number;
  officialCardNumber: string;
  officialCardHolder: string;
  officialBank: string;
  lang: 'az' | 'en' | 'ru' | 'tr';
  userId: string;
  username: string;
  onConfirmPayment: (receiptFile: File | null, previewUrl: string | null, detectedDate?: number) => void;
}

export const DepositPaymentModal: React.FC<DepositPaymentModalProps> = ({
  isOpen,
  onClose,
  depositAmount,
  officialCardNumber,
  officialCardHolder,
  officialBank,
  lang,
  userId,
  username,
  onConfirmPayment,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [detectedTimestamp, setDetectedTimestamp] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyCard = () => {
    navigator.clipboard?.writeText(officialCardNumber.replace(/\s+/g, ''));
    setCopied(true);
    soundManager.playButtonClick();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDetectedTimestamp(file.lastModified || Date.now());
      setErrorMsg(null);
      soundManager.playButtonClick();

      // Read as base64 data URL so Admin can inspect on any device
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPreviewUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedFile) {
      soundManager.playButtonClick();
      setErrorMsg(
        lang === 'az'
          ? '⚠️ Zəhmət olmasa ödəniş etdiyiniz bank çekinin rəsmi şəklini əlavə edin!'
          : '⚠️ Please attach your official bank payment receipt!'
      );
      return;
    }

    setIsVerifying(true);
    soundManager.playButtonClick();

    try {
      // 1. Deep AI & Firebase Anti-Fraud Timestamp & Duplicate check
      const verification = await verifyDepositReceipt(
        selectedFile,
        depositAmount,
        userId,
        username
      );

      if (!verification.isValid) {
        // Fraud detected or invalid receipt!
        soundManager.playErrorSound();
        setErrorMsg(verification.errorMessage);
        await logFraudAttempt(
          userId,
          username,
          verification.errorMessage,
          depositAmount,
          verification.receiptHash
        );
        setIsVerifying(false);
        return;
      }

      // 2. Receipt passed! Mark as verified in Firebase
      await markReceiptAsUsed(
        verification.receiptHash,
        userId,
        username,
        depositAmount,
        'USD'
      );

      soundManager.playChipSound();
      onConfirmPayment(selectedFile, previewUrl, verification.detectedTimestamp);
      onClose();
    } catch (err: any) {
      console.error('Verification error:', err);
      setErrorMsg(lang === 'az' ? 'Yoxlama zamanı xəta baş verdi, yenidən cəhd edin.' : 'Verification error occurred.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-zinc-950 border border-amber-500/50 rounded-2xl text-zinc-100 shadow-2xl shadow-amber-500/20 overflow-hidden"
      >
        {/* Modal Header (Sticky) */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm shrink-0">
          {/* Mobile Drag Indicator */}
          <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-2.5 sm:hidden" />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  {lang === 'az' ? 'Ödəniş Məlumatları' : 'Payment Details'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {lang === 'az' ? 'Kartı kopyalayın və çeki əlavə edin' : 'Copy card & upload payment receipt'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  onClose();
                }}
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                {lang === 'az' ? '← Geri' : '← Back'}
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  onClose();
                }}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Amount Badge */}
          <div className="p-3 bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-zinc-300 font-medium">
                {lang === 'az' ? 'Köçürüləcək Məbləğ:' : 'Transfer Amount:'}
              </span>
            </div>
            <div className="text-lg font-mono font-black text-emerald-400">
              +${depositAmount.toFixed(2)} USD
            </div>
          </div>

          {/* Official Bank Card Box */}
          <div className="p-3.5 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-amber-500/30 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{lang === 'az' ? 'Sistemin Rəsmi Qəbul Kartı' : 'Official System Card'}</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                ● Onlayn
              </span>
            </div>

            {/* Card Number & Copy Button */}
            <div className="flex items-center justify-between p-2.5 bg-black/70 border border-zinc-800 rounded-lg">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {lang === 'az' ? 'Kart Nömrəsi' : 'Card Number'}
                </div>
                <div className="text-sm sm:text-base font-mono font-black text-amber-400 tracking-wider">
                  {officialCardNumber}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCard}
                id="modal_copy_system_card_btn"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95 ${
                  copied
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{lang === 'az' ? 'Kopyalandı!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'az' ? 'Kopyala' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-0.5">
              <div>
                <span className="text-zinc-500">{lang === 'az' ? 'Kart Sahibi:' : 'Cardholder:'} </span>
                <strong className="text-zinc-200 font-semibold">{officialCardHolder}</strong>
              </div>
              <div>
                <span className="text-zinc-500">{lang === 'az' ? 'Bank:' : 'Bank:'} </span>
                <strong className="text-zinc-200 font-semibold">{officialBank}</strong>
              </div>
            </div>
          </div>

          {/* Anti-Fraud Security Notice */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1.5 text-xs text-zinc-300">
            <div className="flex items-center space-x-1.5 font-bold text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'az' ? 'Firebase Anti-Fırıldaqçılıq & Dəqiq Tarix Yoxlanışı' : 'Firebase Anti-Fraud & Timestamp Verification'}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {lang === 'az'
                ? 'Sistem çekin tarixini, saatını, saniyəsini və rəqəmsal imzasını avtomatik incələyir. Saxta və ya təkrar çek yükləndikdə depozit dərhal uğursuz edilir.'
                : 'The system automatically inspects receipt date, hour, second, and hash signature. Tampered or duplicate receipts are blocked immediately.'}
            </p>
          </div>

          {/* Receipt Upload Box */}
          <div className="p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-2">
            <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>{lang === 'az' ? 'Ödəniş Çekini Əlavə Edin' : 'Attach Payment Receipt'}</span>
              </span>
              <span className="text-[10.5px] text-zinc-400 font-normal">
                {lang === 'az' ? '(Screenshot / Şəkil)' : '(Screenshot / Photo)'}
              </span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              disabled={isVerifying}
              className="hidden"
            />

            {previewUrl ? (
              <div className="p-2 bg-zinc-950 border border-emerald-500/50 rounded-xl flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img
                    src={previewUrl}
                    alt="Receipt Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-zinc-700 shrink-0 shadow"
                  />
                  <div className="min-w-0 text-xs">
                    <div className="font-bold text-emerald-400 flex items-center space-x-1">
                      <FileCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {selectedFile?.name || 'bank_receipt.png'}
                      </span>
                    </div>
                    {detectedTimestamp && (
                      <div className="text-[10.5px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="font-mono text-[10px]">
                          {new Date(detectedTimestamp).toLocaleString('az-AZ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {lang === 'az' ? 'Dəyiş' : 'Change'}
                  </button>
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setDetectedTimestamp(null);
                      soundManager.playButtonClick();
                    }}
                    className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-850 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !isVerifying && fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-amber-400 rounded-xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-zinc-950/50 hover:bg-zinc-900/60 group"
              >
                <Upload className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 mb-1 transition-colors" />
                <span className="text-xs font-bold text-zinc-200 group-hover:text-white">
                  {lang === 'az' ? 'Ödəniş çekini seçmək üçün bura toxunun' : 'Tap to upload payment receipt'}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5">
                  Mobil Bank Ekran Görüntüsü / Çek Şəkli
                </span>
              </div>
            )}
          </div>

          {/* Validation Error */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-red-950/90 border border-red-500 rounded-xl text-red-200 text-xs flex items-start space-x-2 shadow-lg"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button: Ödənişi etdim */}
          <button
            type="submit"
            id="modal_confirm_payment_btn"
            disabled={isVerifying}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black rounded-xl text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                <span>{lang === 'az' ? 'Çek və Tarix Yoxlanılır...' : 'Verifying Receipt & Date...'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{lang === 'az' ? '💳 Ödənişi Təsdiq Et və Adminə Göndər' : 'Confirm Payment & Submit to Admin'}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
