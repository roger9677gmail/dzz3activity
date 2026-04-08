'use client';
import { useState } from 'react';
import { formatMoney } from '@/lib/utils';
import PaymentForm from '@/components/registrations/PaymentForm';

export default function RegistrationPaymentInline({ reg }) {
  const [expanded, setExpanded] = useState(false);
  const [currentReg, setCurrentReg] = useState(reg);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-gray-800">{reg.member_name}</div>
            <div className="text-sm text-gray-500">{reg.member_phone}</div>
            <div className="text-xs text-gray-400 mt-1">
              {reg.items.map((i) => `${i.item_name}×${i.quantity}`).join(' · ')}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentReg.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'
            }`}>
              {currentReg.payment_status === 'paid' ? '已繳款' : '待繳款'}
            </span>
            <span className="font-bold text-temple-red text-sm">{formatMoney(reg.total_amount)}</span>
            <span className="text-xs text-gray-400">{expanded ? '▲ 收合' : '▼ 繳款登錄'}</span>
          </div>
        </div>
        {currentReg.receipt_number && (
          <div className="text-xs text-blue-500 mt-1.5">
            收據：{currentReg.receipt_number} {currentReg.payment_date && `・ ${currentReg.payment_date}`}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {/* Items detail */}
          <div className="mb-3 space-y-1">
            {reg.items.map((item) => {
              const names = item.names ? JSON.parse(item.names) : [];
              return (
                <div key={item.id} className="text-sm">
                  <span className="text-gray-700">{item.item_name} × {item.quantity}</span>
                  {names.length > 0 && <span className="text-gray-400 ml-1">（{names.join('、')}）</span>}
                </div>
              );
            })}
          </div>
          {reg.notes && <div className="text-xs text-gray-400 mb-3">備註：{reg.notes}</div>}
          <PaymentForm registration={currentReg} onSuccess={(updated) => setCurrentReg((p) => ({ ...p, ...updated }))} />
        </div>
      )}
    </div>
  );
}
