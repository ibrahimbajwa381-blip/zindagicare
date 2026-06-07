import { z } from "zod";

export const consultCheckoutSchema = z.object({
  doctorId: z.string().min(1),
  slotId: z.string().min(1),
  patientNotes: z.string().max(500).optional(),
});

export const jazzcashIpnSchema = z
  .object({
    pp_Amount: z.string().optional(),
    pp_AuthCode: z.string().optional(),
    pp_BankID: z.string().optional(),
    pp_BillReference: z.string().optional(),
    pp_Language: z.string().optional(),
    pp_MerchantID: z.string().optional(),
    pp_ResponseCode: z.string().optional(),
    pp_ResponseMessage: z.string().optional(),
    pp_RetreivalReferenceNo: z.string().optional(),
    pp_SecureHash: z.string().optional(),
    pp_SettlementExpiry: z.string().optional(),
    pp_SubMerchantID: z.string().optional(),
    pp_TxnCurrency: z.string().optional(),
    pp_TxnDateTime: z.string().optional(),
    pp_TxnRefNo: z.string().optional(),
    pp_TxnType: z.string().optional(),
    pp_Version: z.string().optional(),
    ppmpf_1: z.string().optional(),
    ppmpf_2: z.string().optional(),
    ppmpf_3: z.string().optional(),
    ppmpf_4: z.string().optional(),
    ppmpf_5: z.string().optional(),
  })
  .passthrough();

export type ConsultCheckoutInput = z.infer<typeof consultCheckoutSchema>;
export type JazzcashIpnPayload = z.infer<typeof jazzcashIpnSchema>;
