export type NessieCreated<T> = { code?: number; message?: string; objectCreated?: T };

export type NessieCustomer = {
  _id: string;
  first_name: string;
  last_name: string;
};

export type NessieAccount = {
  _id: string;
  account_number?: string;
  nickname?: string;
  balance?: number;
};

export type NessieBill = {
  _id: string;
  payee?: string;
  nickname?: string;
  payment_amount?: number;
  payment_date?: string;
  upcoming_payment_date?: string;
};

export type NessiePurchase = {
  _id: string;
  amount?: number;
  purchase_date?: string;
  description?: string;
  status?: string;
};

export type DemoPersona = {
  lang: string;
  first: string;
  last: string;
  customer_id: string;
  account_id: string;
  bill_id: string;
  payee: string;
  monthly: number;
};
