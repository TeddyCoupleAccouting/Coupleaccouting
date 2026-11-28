
import { Fragment, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { jsPDF } from "jspdf";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import { supabase } from "./supabase";
import Auth from "./Auth";

type Space = "household" | "personal";
type Tab = "Home" | "Activity" | "Reports" | "My Finance" | "Settings";
type TransactionType = "expense" | "income";

type Transaction = {
    id: string | number;
  name: string;
  category: string;
  categoryId?: string | null;
  amount: number;
  type: TransactionType;
  space: Space;
  date: string;
  notes?: string | null;
  icon: string;
  paidByUserId?: string;
splitMethod?: string | null;
shares?: { userId: string; amount: number }[];
balanceMessage?: string;
};

type HouseholdMember = {
  user_id: string;
  display_name: string;
  avatar?: string | null;
  role?: string;
};

type HouseholdRecord = {
  id: string;
  name: string;
  currency: string;
  icon: string | null;
  role: string;
  memberCount: number;
};

const householdIconDisplay = (icon: string | null | undefined) => {
  const iconMap: Record<string, string> = {
    "house-heart": "🏡",
    "home": "🏠",
    "heart": "💗",
    "sprout": "🌱",
    "coffee": "☕",
    "paw-print": "🐾",
    "briefcase": "🧳",
    "building": "🏢",
  };
  if (!icon) return "🏡";
  return iconMap[icon] ?? (icon.length > 4 ? "🏡" : icon);
};

type CategoryRecord = {
  id: string;
  household_id: string | null;
  name: string;
  kind: TransactionType;
  is_default: boolean;
  created_by: string;
  parent_id: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};



const money = (amount: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);

export default function App() {


const [showAllRepayments, setShowAllRepayments] = useState(false);
const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
const [households, setHouseholds] = useState<HouseholdRecord[]>([]);
const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
const [householdSettingsTab, setHouseholdSettingsTab] = useState<"general" | "members" | "invitations" | "permissions">("general");
const [settingsSection, setSettingsSection] = useState<"profile" | "households" | "personal" | "preferences">("profile");
const [householdNameDraft, setHouseholdNameDraft] = useState("");
const [householdIconDraft, setHouseholdIconDraft] = useState("🏡");
const [householdMessage, setHouseholdMessage] = useState("");
const [householdSaving, setHouseholdSaving] = useState(false);
const [memberEditId, setMemberEditId] = useState<string | null>(null);
const [memberNameDraft, setMemberNameDraft] = useState("");
const [memberAvatarDraft, setMemberAvatarDraft] = useState("🐻");
const [inviteEmail, setInviteEmail] = useState("");
const [inviteMessage, setInviteMessage] = useState("");
const [showCreateHousehold, setShowCreateHousehold] = useState(false);
const [newHouseholdName, setNewHouseholdName] = useState("");
const [session, setSession] = useState<Session | null>(null);
const [authLoading, setAuthLoading] = useState(true);
const [displayName, setDisplayName] = useState("");
const [profileMessage, setProfileMessage] = useState("");
const [categories, setCategories] = useState<CategoryRecord[]>([]);
const [categoryKindTab, setCategoryKindTab] = useState<TransactionType>("expense");
const [categoryFormName, setCategoryFormName] = useState("");
const [categoryFormIcon, setCategoryFormIcon] = useState("📁");
const [categoryFormParentId, setCategoryFormParentId] = useState("");
const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
const [categoryMessage, setCategoryMessage] = useState("");
const [categorySaving, setCategorySaving] = useState(false);
const [categoryLoading, setCategoryLoading] = useState(false);
const [categoryHouseholdId, setCategoryHouseholdId] = useState<string | null>(null);
const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
const [openCategoryMenuId, setOpenCategoryMenuId] = useState<string | null>(null);
const [showCategoryEditor, setShowCategoryEditor] = useState(false);


  useEffect(() => {
    if (!session?.user) {
      setHouseholds([]);
      setActiveHouseholdId(null);
      return;
    }
    let cancelled = false;
    async function loadHouseholds() {
      const { data: memberships, error } = await supabase
        .from("household_members")
        .select("household_id, role")
        .eq("user_id", session!.user.id);
      if (error) {
        console.error("Failed to load households:", error.message);
        return;
      }
      const ids = (memberships ?? []).map((row) => row.household_id);
      if (!ids.length) {
        if (!cancelled) { setHouseholds([]); setActiveHouseholdId(null); }
        return;
      }
      const { data: rows, error: householdError } = await supabase
        .from("households")
        .select("id, name, currency, icon")
        .in("id", ids)
        .order("created_at", { ascending: true });
      if (householdError) {
        console.error("Failed to load household details:", householdError.message);
        return;
      }
      const roleById = new Map((memberships ?? []).map((row) => [row.household_id, row.role]));
      const { data: memberRows } = await supabase
        .from("household_members")
        .select("household_id, user_id")
        .in("household_id", ids);
      const countById = new Map<string, number>();
      (memberRows ?? []).forEach((row) => countById.set(row.household_id, (countById.get(row.household_id) ?? 0) + 1));
      const loaded = (rows ?? []).map((row) => ({
        ...row,
        icon: row.icon ?? "🏡",
        role: roleById.get(row.id) ?? "member",
        memberCount: countById.get(row.id) ?? 0,
      })) as HouseholdRecord[];
      if (!cancelled) {
        setHouseholds(loaded);
        setActiveHouseholdId((current) => current && loaded.some((h) => h.id === current) ? current : loaded[0]?.id ?? null);
      }
    }
    void loadHouseholds();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    const active = households.find((item) => item.id === activeHouseholdId);
    if (active) {
      setHouseholdNameDraft(active.name);
      setHouseholdIconDraft(householdIconDisplay(active.icon));
    }
  }, [activeHouseholdId, households]);

    useEffect(() => {
    if (!session) {
      setHouseholdMembers([]);
      return;
    }

    let cancelled = false;

    async function loadHouseholdMembers() {
      if (!activeHouseholdId) {
        setHouseholdMembers([]);
        return;
      }
      const householdId = activeHouseholdId;
      // Clear the previous household's members while the newly selected household loads.
      setHouseholdMembers([]);

      const { data: members, error: membersError } = await supabase
        .from("household_members")
        .select("user_id, display_name, avatar, role")
        .eq("household_id", householdId);

      if (membersError) {
        console.error("Failed to load members:", membersError.message);
        return;
      }

      const userIds = (members ?? []).map((member) => member.user_id);

      if (userIds.length === 0) {
        if (!cancelled) setHouseholdMembers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("Failed to load profiles:", profilesError.message);
      }

      const names = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.display_name,
        ])
      );

      const loadedMembers = userIds.map((userId) => {
        const row = (members ?? []).find((member) => member.user_id === userId);
        return {
          user_id: userId,
          display_name: row?.display_name || names.get(userId) || "Household member",
          avatar: row?.avatar || null,
          role: row?.role || "member",
        };
      });

      if (!cancelled) {
        setHouseholdMembers(loadedMembers);
      }
    }

    void loadHouseholdMembers();

    return () => {
      cancelled = true;
    };
  }, [session, activeHouseholdId]);

  useEffect(() => {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Session check failed:", error.message);
      setAuthLoading(false);
      return;
    }

    setSession(data.session);
    setAuthLoading(false);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

    return () => subscription.unsubscribe();
}, []);


  useEffect(() => {
    const firstParent = categories.find((item) => item.kind === categoryKindTab && item.parent_id === null);
    setExpandedCategoryIds(firstParent ? [firstParent.id] : []);
  }, [categoryKindTab, categories]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      if (!session?.user) {
        setCategories([]);
        setCategoryHouseholdId(null);
        return;
      }

      setCategoryLoading(true);
      const householdId = activeHouseholdId;
      if (!householdId) {
        console.error("No active household is selected for categories.");
        if (!cancelled) {
          setCategoryMessage("Couldn't find your household. Please refresh and try again.");
          setCategoryLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .select("id, household_id, name, kind, is_default, created_by, parent_id, icon, is_active, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to load categories:", error.message);
        if (!cancelled) setCategoryMessage("Couldn't load categories. Please refresh and try again.");
      } else if (!cancelled) {
        setCategoryHouseholdId(householdId);
        setCategoryMessage("");
        setCategories((data ?? []) as CategoryRecord[]);
      }

      if (!cancelled) setCategoryLoading(false);
    }

    void loadCategories();
    return () => { cancelled = true; };
  }, [session, activeHouseholdId]);

  function resetCategoryForm() {
    setCategoryFormName("");
    setCategoryFormIcon("📁");
    setCategoryFormParentId("");
    setEditingCategoryId(null);
    setCategoryMessage("");
    setShowCategoryEditor(false);
  }

  function startEditCategory(item: CategoryRecord) {
    setEditingCategoryId(item.id);
    setCategoryFormName(item.name);
    setCategoryFormIcon(item.icon || "📁");
    setCategoryFormParentId(item.parent_id || "");
    setCategoryMessage("");
    setCategoryKindTab(item.kind);
    setShowCategoryEditor(true);
    setOpenCategoryMenuId(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || !categoryHouseholdId) {
      setCategoryMessage("Please sign in and make sure you are in a household.");
      return;
    }
    const trimmedName = categoryFormName.trim();
    if (!trimmedName) {
      setCategoryMessage("Please enter a category name.");
      return;
    }
    if (categoryFormParentId === editingCategoryId) {
      setCategoryMessage("A category cannot be its own parent.");
      return;
    }

    setCategorySaving(true);
    setCategoryMessage("");
    const payload = {
      name: trimmedName,
      icon: categoryFormIcon.trim() || "📁",
      parent_id: categoryFormParentId || null,
    };

    const result = editingCategoryId
      ? await supabase.from("categories").update(payload).eq("id", editingCategoryId)
      : await supabase.from("categories").insert({
          ...payload,
          household_id: categoryHouseholdId,
          kind: categoryKindTab,
          created_by: session.user.id,
          is_default: false,
          is_active: true,
          sort_order: categories.filter((item) => item.kind === categoryKindTab && item.parent_id === (categoryFormParentId || null)).length,
        });

    if (result.error) {
      console.error("Failed to save category:", result.error.message);
      setCategoryMessage(`Couldn't save category: ${result.error.message}`);
    } else {
      const { data, error } = await supabase
        .from("categories")
        .select("id, household_id, name, kind, is_default, created_by, parent_id, icon, is_active, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (!error) setCategories((data ?? []) as CategoryRecord[]);
      resetCategoryForm();
      setCategoryMessage("Category saved successfully.");
    }
    setCategorySaving(false);
  }

  async function toggleCategoryActive(item: CategoryRecord) {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) {
      console.error("Failed to update category status:", error.message);
      setCategoryMessage("Couldn't update this category. Please try again.");
      return;
    }
    setCategories((current) => current.map((category) =>
      category.id === item.id ? { ...category, is_active: !item.is_active } : category
    ));
    setCategoryMessage(item.is_active ? "Category hidden from new entries." : "Category activated.");
  }

async function saveHouseholdDetails() {
  if (!activeHouseholdId || !householdNameDraft.trim()) {
    setHouseholdMessage("Please enter a household name.");
    return;
  }
  setHouseholdSaving(true);
  const { error } = await supabase.from("households")
    .update({ name: householdNameDraft.trim(), icon: householdIconDraft })
    .eq("id", activeHouseholdId);
  if (error) setHouseholdMessage(`Couldn't save household: ${error.message}`);
  else {
    setHouseholds((current) => current.map((h) => h.id === activeHouseholdId ? { ...h, name: householdNameDraft.trim(), icon: householdIconDraft } : h));
    setHouseholdMessage("Household updated successfully.");
  }
  setHouseholdSaving(false);
}

async function createHousehold() {
  if (!session?.user || !newHouseholdName.trim()) return;
  setHouseholdSaving(true);
  const { data: created, error } = await supabase.from("households")
    .insert({ name: newHouseholdName.trim(), currency: "THB", created_by: session.user.id, icon: "🏡" })
    .select("id, name, currency, icon")
    .single();
  if (error) {
    setHouseholdMessage(`Couldn't create household: ${error.message}`);
    setHouseholdSaving(false);
    return;
  }
  // The existing add_household_creator trigger creates the owner's membership.
  setHouseholds((current) => [...current, { ...created, icon: created.icon ?? "🏡", role: "owner", memberCount: 1 }]);
  setActiveHouseholdId(created.id);
  setNewHouseholdName("");
  setShowCreateHousehold(false);
  setHouseholdMessage("Your new household is ready!");
  setHouseholdSaving(false);
}

async function saveMemberIdentity(memberId: string) {
  if (!activeHouseholdId || !memberNameDraft.trim()) return;
  const { error } = await supabase.from("household_members")
    .update({ display_name: memberNameDraft.trim(), avatar: memberAvatarDraft })
    .eq("household_id", activeHouseholdId)
    .eq("user_id", memberId);
  if (error) {
    setHouseholdMessage(`Couldn't update member: ${error.message}`);
    return;
  }
  setHouseholdMembers((current) => current.map((m) => m.user_id === memberId ? { ...m, display_name: memberNameDraft.trim(), avatar: memberAvatarDraft } : m));
  setMemberEditId(null);
  setHouseholdMessage("Member details updated.");
}

async function createHouseholdInvitation() {
  if (!activeHouseholdId || !inviteEmail.trim()) return;
  const { error } = await supabase.from("household_invitations").insert({
    household_id: activeHouseholdId,
    email: inviteEmail.trim().toLowerCase(),
    invited_by: session!.user.id,
    role: "member",
  });
  setInviteMessage(error ? `Couldn't create invitation: ${error.message}` : "Invitation created. Email delivery still needs to be connected.");
  if (!error) setInviteEmail("");
}

async function handleSaveProfile() {
  if (!session?.user) {
    setProfileMessage("Please sign in again.");
    return;
  }

  const trimmedName = displayName.trim();

  if (!trimmedName) {
    setProfileMessage("Please enter a display name.");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmedName })
    .eq("id", session.user.id);

  if (error) {
    console.error("Failed to save profile:", error.message);
    setProfileMessage("Couldn't save your profile. Please try again.");
    return;
  }

  setDisplayName(trimmedName);
  setHouseholdMembers((current) => current.map((member) =>
    member.user_id === session.user.id
      ? { ...member, display_name: trimmedName }
      : member
  ));
  setProfileMessage("Profile saved successfully!");
}

async function handleSignOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out failed:", error.message);
  }
}
  const [tab, setTab] = useState<Tab>("Home");
  
  const [space, setSpace] = useState<Space>("household");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

const [comparisonMonth, setComparisonMonth] = useState(() => {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
});

  const [sharedBalance, setSharedBalance] = useState(0);
  useEffect(() => {
  async function loadMyProfile() {
    if (!session?.user) {
      setDisplayName("");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load my profile:", error.message);
      return;
    }

    setDisplayName(data?.display_name ?? "");
  }

  void loadMyProfile();
}, [session]);

type Settlement = {
  id: string;
  household_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  settled_on: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

const [settlements, setSettlements] = useState<Settlement[]>([]);
const [showRepaymentForm, setShowRepaymentForm] = useState(false);
const [repaymentAmount, setRepaymentAmount] = useState("");
const [repaymentPaidBy, setRepaymentPaidBy] = useState("");
const [repaymentPaidTo, setRepaymentPaidTo] = useState("");
const [repaymentDate, setRepaymentDate] = useState(
  new Date().toISOString().slice(0, 10)
);
const [repaymentNote, setRepaymentNote] = useState("");
const [repaymentError, setRepaymentError] = useState("");
const [repaymentSaving, setRepaymentSaving] = useState(false);

const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  
const [selectedTransaction, setSelectedTransaction] =
  useState<Transaction | null>(null);

const [isEditingTransaction, setIsEditingTransaction] = useState(false);
const [editName, setEditName] = useState("");
const [editAmount, setEditAmount] = useState("");
const [editNotes, setEditNotes] = useState("");
const [editCategory, setEditCategory] = useState("");
const [editDate, setEditDate] = useState("");

const [editError, setEditError] = useState("");
const [savingEdit, setSavingEdit] = useState(false);

const [search, setSearch] = useState("");
const [showActivityFilters, setShowActivityFilters] = useState(false);

const [activityTypeFilter, setActivityTypeFilter] = useState<
  "all" | "expense" | "income"
>("all");

const [activityCategoryFilter, setActivityCategoryFilter] =
  useState("all");

const [activityPersonFilter, setActivityPersonFilter] =
  useState("all");

const [activityStartDate, setActivityStartDate] = useState("");
const [activityEndDate, setActivityEndDate] = useState("");

  const [kind, setKind] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({});
  const [splitMethod, setSplitMethod] = useState<
  "equal" | "custom" | "percentage" | "shares" | "adjustment"
  >("equal");

  useEffect(() => {
    if (!session) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      if (!session) return;
      const { data, error } = await supabase
        .from("transactions")
        .select(
      "id, household_id, created_by, scope, kind, amount, description, occurred_on, category_id, paid_by, split_method, notes"
)
        .or(`household_id.eq.${activeHouseholdId ?? "00000000-0000-0000-0000-000000000000"},and(scope.eq.private,created_by.eq.${session.user.id})`)
        .order("occurred_on", { ascending: false });

      if (error) {
        console.error("Failed to load transactions:", error.message);
        return;
      }

      const { data: categories, error: categoryError } = await supabase
        .from("categories")
        .select("id, name");

      if (categoryError) {
        console.error("Failed to load categories:", categoryError.message);
      }

      const categoryNames = new Map(
        (categories ?? []).map((item) => [item.id, item.name])
      );

      const loaded: Transaction[] = (data ?? []).map((item) => ({
        id: item.id,
        name: item.description,
        category: item.category_id
          ? categoryNames.get(item.category_id) ?? "Other Expenses"
          : "Other Expenses",
        categoryId: item.category_id ?? null,
        amount: Number(item.amount),
        type: item.kind,
        space: item.scope === "shared" ? "household" : "personal",
        date: item.occurred_on,
        notes: item.notes,
        icon: item.kind === "income" ? "💰" : "🧾",
        paidByUserId: item.paid_by,
        splitMethod: item.split_method,
      }));

const { data: splits, error: splitsError } = await supabase
  .from("transaction_splits")
  .select("transaction_id, user_id, share_amount");

if (splitsError) {
  console.error("Failed to load transaction splits:", splitsError.message);
}

let loadedSettlements: Settlement[] = [];

if (activeHouseholdId) {
  const { data: settlementData, error: settlementError } = await supabase
    .from("settlements")
    .select(
      "id, household_id, paid_by, paid_to, amount, status, settled_on, note, created_by, created_at"
    )
    .eq("household_id", activeHouseholdId)
    .order("created_at", { ascending: false });

  if (settlementError) {
    console.error("Failed to load settlements:", settlementError.message);
  } else {
    loadedSettlements = (settlementData ?? []) as Settlement[];
  }
}

for (const split of splits ?? []) {
  const transaction = loaded.find(
    (item) => String(item.id) === String(split.transaction_id)
  );

  if (!transaction) continue;

  transaction.shares ??= [];
  transaction.shares.push({
    userId: split.user_id,
    amount: Number(split.share_amount),
  });
}

const transactionById = new Map(
  (data ?? []).map((item) => [item.id, item])
);

let balance = 0;

for (const split of splits ?? []) {
  const transaction = transactionById.get(split.transaction_id);

  if (
    !transaction ||
    transaction.scope !== "shared" ||
    transaction.kind !== "expense"
  ) {
    continue;
  }

  if (
  transaction.paid_by === session?.user.id &&
  split.user_id !== session?.user.id
) {
  balance += Number(split.share_amount);
} else if (
  transaction.paid_by !== session?.user.id &&
  split.user_id === session?.user.id
) {
  balance -= Number(split.share_amount);
  }
}

for (const settlement of loadedSettlements) {
  if (settlement.status !== "completed") continue;

  if (settlement.paid_by === session.user.id) {
    balance += Number(settlement.amount);
  } else if (settlement.paid_to === session.user.id) {
    balance -= Number(settlement.amount);
  }
}
      if (!cancelled) {
  setSharedBalance(balance);
  setTransactions(loaded)
  setSettlements(loadedSettlements);
    }
    }

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [session, activeHouseholdId]);

  const personal = space === "personal";
  const activeHousehold = households.find((home) => home.id === activeHouseholdId) ?? null;
  // Put the signed-in user first, then show the other member of this selected household.
  const bannerHouseholdMembers = [...householdMembers]
    .sort((a, b) => Number(b.user_id === session?.user.id) - Number(a.user_id === session?.user.id))
    .slice(0, 2);
  const visibleTransactions = transactions.filter(
    (item) => item.space === space
  );

  
const filteredTransactions = visibleTransactions.filter((item) => {
  const matchesSearch =
    `${item.name} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase());

  const matchesType =
    activityTypeFilter === "all" ||
    item.type === activityTypeFilter;

  const matchesCategory =
    activityCategoryFilter === "all" ||
    item.category === activityCategoryFilter;

  const matchesStartDate =
    !activityStartDate || item.date >= activityStartDate;

  const matchesEndDate =
    !activityEndDate || item.date.slice(0, 10) <= activityEndDate;
    const matchesPerson =
  activityPersonFilter === "all" ||
  (
    item.space === "household" &&
    item.paidByUserId === activityPersonFilter
  );
  return (
  matchesSearch &&
  matchesType &&
  matchesCategory &&
  matchesStartDate &&
  matchesEndDate &&
  matchesPerson
 );
});

  const totalIncome = visibleTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpenses = visibleTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
    const now = new Date();
const currentMonth =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;


const householdMonthlyTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === currentMonth
);

const householdMonthlyIncome = householdMonthlyTransactions
  .filter((item) => item.type === "income")
  .reduce((sum, item) => sum + item.amount, 0);

const householdMonthlyExpenses = householdMonthlyTransactions
  .filter((item) => item.type === "expense")
  .reduce((sum, item) => sum + item.amount, 0);

const householdMonthlyDifference =
  householdMonthlyIncome - householdMonthlyExpenses;


const selectedMonthDate = new Date(
  Number(comparisonMonth.slice(0, 4)),
  Number(comparisonMonth.slice(5, 7)) - 1,
  1
);

const selectedMonth =
  `${selectedMonthDate.getFullYear()}-${String(
    selectedMonthDate.getMonth() + 1
  ).padStart(2, "0")}`;

const previousMonthDate = new Date(
  selectedMonthDate.getFullYear(),
  selectedMonthDate.getMonth() - 1,
  1
);

const previousMonth =
  `${previousMonthDate.getFullYear()}-${String(
    previousMonthDate.getMonth() + 1
  ).padStart(2, "0")}`;

const householdPreviousMonthTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === previousMonth
);

const householdPreviousMonthIncome =
  householdPreviousMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

const householdPreviousMonthExpenses =
  householdPreviousMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

const householdSelectedMonthTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === selectedMonth
);

const householdSelectedMonthIncome =
  householdSelectedMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

const householdSelectedMonthExpenses =
  householdSelectedMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

const householdIncomeChange =
  householdSelectedMonthIncome - householdPreviousMonthIncome;

const householdExpensesChange =
  householdSelectedMonthExpenses - householdPreviousMonthExpenses;

const currentMonthLabel = selectedMonthDate.toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});

const previousMonthLabel = previousMonthDate.toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});

const householdCategoryTotals = householdMonthlyTransactions
  .filter((item) => item.type === "expense")
  .reduce<Record<string, number>>((totals, item) => {
    totals[item.category] =
      (totals[item.category] ?? 0) + item.amount;
    return totals;
  }, {});

const householdCategoryEntries = Object.entries(
  householdCategoryTotals
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

const highestCategoryAmount =
  householdCategoryEntries[0]?.[1] ?? 0;

  // REPORTS — selected space and selected month
const reportMonthTransactions = transactions.filter(
  (item) =>
    item.space === space &&
    item.date.slice(0, 7) === selectedMonth
);

const reportPreviousMonthTransactions = transactions.filter(
  (item) =>
    item.space === space &&
    item.date.slice(0, 7) === previousMonth
);

// Monthly income and expenses
const reportIncome = reportMonthTransactions
  .filter((item) => item.type === "income")
  .reduce((sum, item) => sum + item.amount, 0);

const reportExpenses = reportMonthTransactions
  .filter((item) => item.type === "expense")
  .reduce((sum, item) => sum + item.amount, 0);

const reportBalance = reportIncome - reportExpenses;

// Previous month
const reportPreviousIncome = reportPreviousMonthTransactions
  .filter((item) => item.type === "income")
  .reduce((sum, item) => sum + item.amount, 0);

const reportPreviousExpenses = reportPreviousMonthTransactions
  .filter((item) => item.type === "expense")
  .reduce((sum, item) => sum + item.amount, 0);

// Month-to-month changes
const reportIncomeChange = reportIncome - reportPreviousIncome;
const reportExpensesChange = reportExpenses - reportPreviousExpenses;

// Expense category breakdown
const reportCategoryTotals = reportMonthTransactions
  .filter((item) => item.type === "expense")
  .reduce<Record<string, number>>((totals, item) => {
    totals[item.category] =
      (totals[item.category] ?? 0) + item.amount;
    return totals;
  }, {});

const reportCategoryEntries = Object.entries(reportCategoryTotals)
  .sort((a, b) => b[1] - a[1]);

  
function exportReportCsv() {
  const headers = [
    "Date",
    "Type",
    "Description",
    "Category",
    "Amount (THB)",
    "Space",
    "Notes",
  ];

  const rows = reportMonthTransactions.map((item) => [
    item.date,
    item.type,
    item.name,
    item.category,
    item.amount,
    item.space,
    item.notes ?? "",
  ]);

  const escapeCsvValue = (value: string | number) => {
    const text = String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csvContent = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csvContent],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `together-report-${selectedMonth}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function exportReportPdf() {
  const doc = new jsPDF();

  const formatAmount = (amount: number) =>
    `THB ${amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;

  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(120, 85, 155);
  doc.text("Monthly Financial Report", 20, y);

  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(currentMonthLabel, 20, y);

  // Summary
  y += 15;
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text("Financial Summary", 20, y);

  y += 9;
  doc.setFontSize(11);
  doc.text(`Total Income: ${formatAmount(reportIncome)}`, 20, y);

  y += 8;
  doc.text(`Total Expenses: ${formatAmount(reportExpenses)}`, 20, y);

  y += 8;
  doc.text(`Remaining Balance: ${formatAmount(reportBalance)}`, 20, y);

  // Expense breakdown
  y += 15;
  doc.setFontSize(14);
  doc.text("Expense Breakdown", 20, y);

  y += 9;
  doc.setFontSize(10);

  if (reportCategoryEntries.length === 0) {
    doc.text("No expenses recorded this month.", 20, y);
    y += 8;
  } else {
    reportCategoryEntries.forEach(([category, amount]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(category, 20, y);
      doc.text(formatAmount(amount), 190, y, { align: "right" });
      y += 8;
    });
  }

  // Monthly comparison
  if (y > 245) {
    doc.addPage();
    y = 20;
  } else {
    y += 10;
  }

  doc.setFontSize(14);
  doc.text("Monthly Comparison", 20, y);

  y += 9;
  doc.setFontSize(10);
  doc.text(
    `Previous month income: ${formatAmount(reportPreviousIncome)}`,
    20,
    y
  );

  y += 8;
  doc.text(
    `Previous month expenses: ${formatAmount(reportPreviousExpenses)}`,
    20,
    y
  );

  // Household settlements
  if (!personal) {
    const settlementTotal = settlements
      .filter(
        (item) =>
          item.status === "completed" &&
          item.settled_on?.slice(0, 7) === selectedMonth
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);

    y += 15;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text("Household Settlements", 20, y);

    y += 9;
    doc.setFontSize(10);
    doc.text(
      `Completed repayments: ${formatAmount(settlementTotal)}`,
      20,
      y
    );
  }

  doc.save(`together-report-${selectedMonth}.pdf`);
}

  function openAdd() {
    setKind("expense");
    setName("");
    setAmount("");
    setCategory("");
    setNote("");
    setShowAdd(true);
  }

  
  async function saveTransaction(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaveError("");

    if (!session) {
      setSaveError("Please sign in again before saving.");
      return;
    }

    const value = Number(amount);

    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      setSaveError("Please enter a name and a valid amount.");
      return;
    }
let calculatedSharesToSave: {
  user_id: string;
  share_amount: number;
}[] = [];

if (space === "household" && kind === "expense") {
  if (
    !paidBy ||
    !householdMembers.some((member) => member.user_id === paidBy)
  ) {
    setSaveError("Please choose who paid for this expense.");
    return;
  }

  

const totalCents = Math.round(value * 100);

const enteredValues = householdMembers.map((member) => ({
  user_id: member.user_id,
  raw: shareAmounts[member.user_id] ?? "",
  amount: Number(shareAmounts[member.user_id]),
}));

let shares: {
  user_id: string;
  share_amount: number;
  entered_amount: string;
}[] = [];

if (splitMethod === "equal") {
  const baseCents = Math.floor(totalCents / householdMembers.length);
  const remainder = totalCents % householdMembers.length;

  shares = householdMembers.map((member, index) => ({
    user_id: member.user_id,
    share_amount:
      (baseCents + (index < remainder ? 1 : 0)) / 100,
    entered_amount: "",
  }));
} else {
  if (
    enteredValues.some(
      (item) =>
        item.raw.trim() === "" ||
        !Number.isFinite(item.amount)
    )
  ) {
    setSaveError("Please enter a valid value for each household member.");
    return;
  }

  if (splitMethod === "custom") {
    if (enteredValues.some((item) => item.amount < 0)) {
      setSaveError("Share amounts cannot be negative.");
      return;
    }

    shares = enteredValues.map((item) => ({
      user_id: item.user_id,
      share_amount: Math.round(item.amount * 100) / 100,
      entered_amount: item.raw,
    }));
  } else if (splitMethod === "percentage") {
    if (
      enteredValues.some((item) => item.amount < 0 || item.amount > 100) ||
      Math.abs(
        enteredValues.reduce((sum, item) => sum + item.amount, 0) - 100
      ) > 0.01
    ) {
      setSaveError("Percentages must add up to 100%.");
      return;
    }

    const calculated = enteredValues.map((item) =>
      Math.round((totalCents * item.amount) / 100)
    );
    const difference =
      totalCents - calculated.reduce((sum, cents) => sum + cents, 0);

    calculated[calculated.length - 1] += difference;

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  } else if (splitMethod === "shares") {
    if (
      enteredValues.some((item) => item.amount < 0) ||
      enteredValues.reduce((sum, item) => sum + item.amount, 0) <= 0
    ) {
      setSaveError("Share units must be non-negative, with at least one share above zero.");
      return;
    }

    const totalUnits = enteredValues.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const calculated = enteredValues.map((item) =>
      Math.round((totalCents * item.amount) / totalUnits)
    );
    const difference =
      totalCents - calculated.reduce((sum, cents) => sum + cents, 0);

    calculated[calculated.length - 1] += difference;

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  } else {
    const adjustments = enteredValues.map((item) =>
      Math.round(item.amount * 100)
    );
    const adjustmentTotal = adjustments.reduce(
      (sum, cents) => sum + cents,
      0
    );

    if (Math.abs(adjustmentTotal) > 1) {
      setSaveError("Adjustments must add up to ฿0.");
      return;
    }

    const baseCents = Math.floor(totalCents / householdMembers.length);
    const remainder = totalCents % householdMembers.length;

    const calculated = householdMembers.map((_, index) =>
      baseCents +
      (index < remainder ? 1 : 0) +
      adjustments[index]
    );

    if (calculated.some((cents) => cents < 0)) {
      setSaveError("An adjustment cannot make a person's share negative.");
      return;
    }

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  }
}


const sharesTotal = shares.reduce(
  (total, share) => total + Math.round(share.share_amount * 100),
  0
);

if (Math.abs(sharesTotal - totalCents) > 1) {
  setSaveError("Each person's shares must add up to the total expense.");
  return;
}

calculatedSharesToSave = shares.map((share) => ({
  user_id: share.user_id,
  share_amount: share.share_amount,
}));

}

    setSaving(true);

    try {
      let householdId: string | null = null;

      if (space === "household") {
        if (!activeHouseholdId) {
          throw new Error(
            "No household membership was found. Your transaction has not been saved."
          );
        }

        householdId = activeHouseholdId;
      }



      const { data: categoryRow, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("id", category)
        .eq("kind", kind)
        .eq("is_active", true)
        .maybeSingle();

      if (categoryError) throw categoryError;

      if (!categoryRow) {
        throw new Error(
          "Please choose an active category. No transaction was saved."
        );
      }

      const now = new Date();
      const occurredOn = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      const { data: saved, error: saveErrorFromDb } = await supabase
        .from("transactions")
        .insert({
          household_id: householdId,
          created_by: session.user.id,
          paid_by:
    space === "household" && kind === "expense"
    ? paidBy
    : session.user.id,
          scope: space === "household" ? "shared" : "private",
          kind,
          category_id: categoryRow.id,
          amount: value,
          description: name.trim(),
          occurred_on: occurredOn,
          split_method:
    space === "household" && kind === "expense"
          ? splitMethod
          : null,
    notes: note.trim() || null,
        })
        .select(
          "id, scope, kind, amount, description, occurred_on, category_id, paid_by, split_method"
        )
        .single();

      if (saveErrorFromDb) throw saveErrorFromDb;

if (space === "household" && kind === "expense") {
  
const splitsToSave = calculatedSharesToSave.map((share) => ({
  transaction_id: saved.id,
  user_id: share.user_id,
  share_amount: share.share_amount,
}));

const { error: splitError } = await supabase
  .from("transaction_splits")
  .insert(splitsToSave);

if (splitError) {
  throw new Error(
    `Transaction was saved, but saving the shares failed: ${splitError.message}`
  );
}
}

      const newTransaction: Transaction = {
        id: saved.id,
        name: saved.description,
        category: categoryRow.name,
        amount: Number(saved.amount),
        type: saved.kind,
        space: saved.scope === "shared" ? "household" : "personal",
        date: saved.occurred_on,
        icon: saved.kind === "income" ? "💰" : "🧾",
      };

      setTransactions((current) => [newTransaction, ...current]);
      setShowAdd(false);
      setTab(space === "personal" ? "My Finance" : "Activity");
    } catch (error) {
      console.error("Failed to save transaction:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }




async function handleSaveTransactionEdit() {
  if (!session || !selectedTransaction) {
    setEditError("Please sign in again before editing.");
    return;
  }

  const trimmedName = editName.trim();
  const value = Number(editAmount);

  const existingShares = selectedTransaction.shares ?? [];

  const existingSharesTotal = existingShares.reduce(
    (total, share) => total + Math.round(share.amount * 100),
    0
  );

  const isChangingSharedExpenseAmount =
    selectedTransaction.space === "household" &&
    selectedTransaction.type === "expense" &&
    Math.round(value * 100) !==
      Math.round(selectedTransaction.amount * 100);

  if (!trimmedName) {
    setEditError("Please enter a transaction name.");
    return;
  }

  if (!Number.isFinite(value) || value <= 0) {
    setEditError("Please enter an amount greater than zero.");
    return;
  }

  if (!editDate) {
    setEditError("Please select a transaction date.");
    return;
  }

  if (!editCategory) {
    setEditError("Please choose a category from your Settings.");
    return;
  }

  if (isChangingSharedExpenseAmount) {
    if (existingShares.length === 0) {
      setEditError(
        "No existing expense splits were found. Please check this transaction first."
      );
      return;
    }

    if (
      existingSharesTotal !==
      Math.round(selectedTransaction.amount * 100)
    ) {
      setEditError(
        "The existing split amounts don't match the transaction total. Please check the split records first."
      );
      return;
    }
  }

  let recalculatedShares: {
    user_id: string;
    share_amount: number;
  }[] = [];

  if (isChangingSharedExpenseAmount) {
    const totalCents = Math.round(value * 100);
    const originalTotalCents = existingSharesTotal;
    let allocatedCents = 0;

    recalculatedShares = existingShares.map((share, index) => {
      const shareCents =
        index === existingShares.length - 1
          ? totalCents - allocatedCents
          : Math.round(
              (totalCents * Math.round(share.amount * 100)) /
                originalTotalCents
            );

      allocatedCents += shareCents;

      return {
        user_id: share.userId,
        share_amount: shareCents / 100,
      };
    });
  }

  setSavingEdit(true);
  setEditError("");

  try {
    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", editCategory)
      .eq("kind", selectedTransaction.type)
      .maybeSingle();

    if (categoryError) throw categoryError;

    if (!categoryRow) {
      throw new Error(
        "That category is no longer available. Please choose another category from Settings."
      );
    }

if (isChangingSharedExpenseAmount) {
  const { error: rpcError } = await supabase.rpc(
    "update_household_expense_with_splits",
    {
      p_transaction_id: selectedTransaction.id,
      p_description: trimmedName,
      p_amount: value,
      p_category_id: categoryRow.id,
      p_occurred_on: editDate,
      p_notes: editNotes.trim() || null,
      p_splits: recalculatedShares,
    }
  );

  if (rpcError) throw rpcError;
} else {
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      description: trimmedName,
      amount: value,
      category_id: categoryRow.id,
      occurred_on: editDate,
      notes: editNotes.trim() || null,
    })
    .eq("id", selectedTransaction.id);

  if (updateError) throw updateError;
}

const updatedTransaction: Transaction = {
  ...selectedTransaction,
  name: trimmedName,
  amount: value,
  category: categoryRow.name,
  categoryId: categoryRow.id,
  date: editDate,
  notes: editNotes.trim() || null,
  shares: isChangingSharedExpenseAmount
    ? recalculatedShares.map((share) => ({
        userId: share.user_id,
        amount: share.share_amount,
      }))
    : selectedTransaction.shares,
};

    setTransactions((current) =>
      current.map((transaction) =>
       String(transaction.id) === String(selectedTransaction.id)
        ? updatedTransaction
        : transaction
      )
      );

    setSelectedTransaction(updatedTransaction);
    setIsEditingTransaction(false);
    setEditError("");
  } catch (error) {
    console.error("Failed to update transaction:", error);
    setEditError(
      error instanceof Error
        ? error.message
        : "Could not save your changes. Please try again."
    );
  } finally {
    setSavingEdit(false);
  }
}


async function handleSaveRepayment() {
  if (!session) return;

  const value = Number(repaymentAmount);

  if (!Number.isFinite(value) || value <= 0) {
    setRepaymentError("Please enter an amount greater than zero.");
    return;
  }

  if (!repaymentPaidBy || !repaymentPaidTo) {
    setRepaymentError("Please choose who paid and who received the money.");
    return;
  }

  if (repaymentPaidBy === repaymentPaidTo) {
    setRepaymentError("The payer and receiver must be different people.");
    return;
  }

  setRepaymentSaving(true);
  setRepaymentError("");

  try {
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership?.household_id) {
      throw new Error("No household membership was found.");
    }

    const { data: saved, error } = await supabase
      .from("settlements")
      .insert({
        household_id: membership.household_id,
        paid_by: repaymentPaidBy,
        paid_to: repaymentPaidTo,
        amount: value,
        status: "completed",
        settled_on: repaymentDate,
        note: repaymentNote.trim() || null,
        created_by: session.user.id,
            })
      .select(
        "id, household_id, paid_by, paid_to, amount, status, settled_on, note, created_by, created_at"
      )
      .single();
      

    if (error) throw error;

    setSettlements((current) => [saved as Settlement, ...current]);

setSharedBalance((current) =>
  repaymentPaidBy === session.user.id
    ? current + value
    : current - value
);

    setRepaymentAmount("");
    setRepaymentNote("");
    setShowRepaymentForm(false);
    setRepaymentPaidBy("");
    setRepaymentPaidTo("");
  } catch (error) {
    console.error("Failed to save repayment:", error);
    setRepaymentError(
      error instanceof Error
        ? error.message
        : "Could not save the repayment. Please try again."
    );
  } finally {
    setRepaymentSaving(false);
  }
}

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "My Finance") setSpace("personal");
    if (nextTab === "Home" || nextTab === "Activity" || nextTab === "Reports") {
      setSpace("household");
    }
  }

  if (authLoading) {
    return (
      <div className="auth-screen auth-loading-screen">
        <div className="auth-loading-card">
          <span className="auth-brand-icon">♡</span>
          <strong>together<span className="auth-brand-dot">.</span></strong>
          <p>Getting your little corner ready...</p>
        </div>
      </div>
    );
  }

  if (!session || window.location.hash.includes("type=recovery")) {
    return <Auth />;
  }

return (
  <div className={`app ${personal ? "personal-theme" : "household-theme"}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()} title={activeHousehold?.name ?? "Together"}>
          <span className="brand-mark">{activeHousehold ? householdIconDisplay(activeHousehold.icon) : "♡"}</span>
          <span className="brand-household-name">{activeHousehold?.name ?? "together."}</span>
        </a>

        <p className="nav-caption">YOUR SPACE</p>
        <nav className="side-nav">
          {(["Home", "Activity", "Reports", "My Finance"] as Tab[]).map(
            (item) => (
              <button
                key={item}
                className={`nav-item ${tab === item ? "active" : ""}`}
                onClick={() => changeTab(item)}
              >
                <span className="nav-icon">
              {({
                  Home: "🏠",
                  Activity: "🕒",
                  Reports: "📊",
                  "My Finance": "💜",
                  Settings: "⚙️",
                } as Record<Tab, string>)[item]}
          </span>
                {item}
                {item === "My Finance" && <span className="private-dot">●</span>}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-couple">
            <div className="avatar avatar-one">🐻</div>
            <div className="avatar avatar-two">🐰</div>
            <div>
              <strong>Our little team</strong>
              <span>Making progress together</span>
            </div>
          </div>
          <button
  className={`settings-button ${tab === "Settings" ? "active" : ""}`}
  onClick={() => setTab("Settings")}
>
  ⚙️ &nbsp; Settings
</button>
          <button className="settings-button" onClick={handleSignOut}>
  ↪ &nbsp; Log out
        </button>
        </div>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {(["Home", "Activity", "Reports", "My Finance", "Settings"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`mobile-bottom-nav-item ${tab === item ? "active" : ""}`}
            onClick={() => changeTab(item)}
          >
            <span className="mobile-bottom-nav-icon">
              {({ Home: "🏠", Activity: "🕒", Reports: "📊", "My Finance": "💜", Settings: "⚙️" } as Record<Tab, string>)[item]}
            </span>
            <span>{item === "My Finance" ? "My Finance" : item}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand" title={activeHousehold?.name ?? "Together"}>
            <span className="brand-mark">{activeHousehold ? householdIconDisplay(activeHousehold.icon) : "♡"}</span>
            <span className="brand-household-name">{activeHousehold?.name ?? "together."}</span>
          </div>
          <div className="breadcrumb">
            <span>YOUR FINANCES</span>
            <span className="breadcrumb-divider">/</span>
            <strong className={tab !== "Settings" && !personal ? "household-finance-breadcrumb" : ""}>{tab === "Settings" ? "Settings" : personal ? "My Personal Finance" : "Household Finance"}</strong>
          </div>
          {!personal && tab !== "Settings" && <select className="topbar-household-select" aria-label="Switch household" value={activeHouseholdId ?? ""} onChange={(e) => setActiveHouseholdId(e.target.value)}>{households.map((home) => <option key={home.id} value={home.id}>{householdIconDisplay(home.icon)} {home.name}</option>)}</select>}
          <button className="profile-button" title="Your profile">🐻</button>
        </header>

        <div className="page-content">
          {tab !== "Settings" && <div className="welcome-row">
            <div>
              <div className="eyebrow">
                {personal ? "YOUR OWN LITTLE CORNER 🌷" : "YOUR LIFE, TOGETHER 💜"}
              </div>
              <h1>
                {personal ? "Your money, your way." : "Together, one little step at a time."}
              </h1>
              <p className="welcome-description">
                {personal
                  ? "A private space for your goals, plans, and peace of mind."
                  : "A little more clarity, a little less money stress."}
              </p>
            </div>
            <button className="primary-button desktop-add" onClick={openAdd}>
              <span>＋</span> Add transaction
            </button>
          </div>

          }
          {tab !== "Settings" && <div className="space-switcher" aria-label="Finance space">
            <button
              className={!personal ? "selected household-option" : ""}
              onClick={() => {
                setSpace("household");
                setTab("Home");
              }}
            >
              💜 Household Finance
            </button>
            <button
              className={personal ? "selected personal-option" : ""}
              onClick={() => {
                setSpace("personal");
                setTab("My Finance");
              }}
            >
              🌷 My Personal Finance <span className="lock-label">PRIVATE</span>
            </button>
          </div>}

          {tab === "Home" && !personal && (
            <>
              <section className="couple-banner">
                <div className="couple-copy">
                  <span className="banner-kicker">OUR LITTLE MONEY</span>
                  <h2>Teamwork looks good on you. 💕</h2>
                  <p>Every small step helps build the life you want together.</p>
                </div>
                <div className="couple-avatars">
                  {bannerHouseholdMembers.length > 0 ? (
                    bannerHouseholdMembers.map((member, index) => (
                      <Fragment key={member.user_id}>
                        {index > 0 && <span className="heart-between">♥</span>}
                        <div className="couple-member">
                          <div className={`big-avatar ${index === 0 ? "bear" : "bunny"}`}>
                            {member.avatar || (index === 0 ? "🐻" : "🐰")}
                          </div>
                          <span>{member.display_name}</span>
                        </div>
                      </Fragment>
                    ))
                  ) : (
                    <div className="couple-member">
                      <div className="big-avatar bear">♡</div>
                      <span>Your household</span>
                    </div>
                  )}
                </div>
                <span className="banner-decoration decoration-one">✦</span>
                <span className="banner-decoration decoration-two">♡</span>
              </section>
  
<section className="balance-card">
                <div className="balance-heading">
                  <span className="balance-icon">♡</span>
                  <div>
                    <span className="card-label">WHO OWES WHOM?</span>
                    <h2>
  {sharedBalance > 0
    ? "Your partner owes you"
    : sharedBalance < 0
      ? "You owe your partner"
      : "You're all settled!"}
</h2>
                  </div>
                </div>
                <div className="balance-main">
                  <div>
                    <div className="balance-amount">{money(sharedBalance)}</div>
                    <p className="balance-subtitle">
  {sharedBalance > 0
    ? "Your partner needs to pay you back. 💕"
    : sharedBalance < 0
      ? "You need to pay your partner back. 💕"
      : "Keep being a great team. 💕"}
      </p>
                  </div>
                  <div className="balance-illustration">🫶</div>
                </div>
                <button className="text-link" onClick={() => setTab("Activity")}>
                  View expense ledger <span>→</span>
                </button>
              </section>



              <section className="summary-grid">
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon income-icon">↗</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Total income</p>
                  <h3>{money(householdMonthlyIncome)}</h3>
                  <span className="summary-foot">Household income</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon expense-icon">↘</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Total expenses</p>
                  <h3>{money(householdMonthlyExpenses)}</h3>
                  <span className="summary-foot">Shared spending</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon difference-icon">♡</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Income minus expenses</p>
                  <h3>{money(householdMonthlyDifference)}</h3>
                  <span className="summary-foot">Household difference</span>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">A LITTLE OVERVIEW</span>
                      <h2>Spending by category</h2>
                    </div>
                    <button className="subtle-button" onClick={() => setTab("Reports")}>See reports →</button>
                  </div>
                  
{householdCategoryEntries.length > 0 ? (
  <div className="category-breakdown">
    {householdCategoryEntries.map(([categoryName, amount]) => (
      <div className="category-row" key={categoryName}>
        <div className="category-row-top">
          <span>{categoryName}</span>
          <strong>{money(amount)}</strong>
        </div>

        <div className="category-bar">
          <div
            className="category-bar-fill"
            style={{
              width: `${
                highestCategoryAmount > 0
                  ? (amount / highestCategoryAmount) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="empty-chart">
    <div className="empty-chart-icon">🌱</div>
    <strong>Your story starts here</strong>
    <span>
      Add household expenses to see your spending breakdown.
    </span>
  </div>
  
)}

                </article>

                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">LITTLE MONEY MOMENTS</span>
                      <h2>Recent activity</h2>
                    </div>
                    <button className="subtle-button" onClick={() => setTab("Activity")}>View all →</button>
                  </div>
                  <TransactionList
                  items={visibleTransactions.slice(0, 3)}
                  householdMembers={householdMembers}
                  currentUserId={session?.user.id ?? ""}
                  onSelectTransaction={setSelectedTransaction}
                  />
                </article>
              </section>
              <section className="panel repayment-panel">
  <div className="panel-heading">
    <div>
      <span className="card-label">HOUSEHOLD FINANCES</span>
      <h2>Repayments 💕</h2>
    </div>
    <button
      className="text-link"
      onClick={() => {
        setShowRepaymentForm((current) => !current);
        setRepaymentError("");
      }}
    >
      {showRepaymentForm ? "Cancel" : "+ Record repayment"}
    </button>
  </div>

  {showRepaymentForm && (
    <div className="repayment-form">
      <label>
        Amount (฿)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={repaymentAmount}
          onChange={(event) => setRepaymentAmount(event.target.value)}
          placeholder="e.g. 200"
        />
      </label>

      
<label>
  Paid by
  <select
    value={repaymentPaidBy}
    onChange={(event) => {
      setRepaymentPaidBy(event.target.value);
      if (event.target.value === repaymentPaidTo) {
        setRepaymentPaidTo("");
      }
    }}
  >
    <option value="">Choose who paid</option>
    {householdMembers.map((member) => (
      <option key={member.user_id} value={member.user_id}>
        {member.display_name}
      </option>
    ))}
  </select>
</label>

<label>
  Paid to
  <select
    value={repaymentPaidTo}
    onChange={(event) => setRepaymentPaidTo(event.target.value)}
  >
    <option value="">Choose who received the money</option>
    {householdMembers
      .filter((member) => member.user_id !== repaymentPaidBy)
      .map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.display_name}
        </option>
      ))}
  </select>
</label>

      <label>
        Payment date
        <input
          type="date"
          value={repaymentDate}
          onChange={(event) => setRepaymentDate(event.target.value)}
        />
      </label>

      <label>
        Note (optional)
        <input
          type="text"
          value={repaymentNote}
          onChange={(event) => setRepaymentNote(event.target.value)}
          placeholder="e.g. Paid back for groceries"
        />
      </label>

      {repaymentError && (
        <p role="alert" className="error-message">
          {repaymentError}
        </p>
      )}

      <button
        className="primary-button"
        onClick={handleSaveRepayment}
        disabled={repaymentSaving}
      >
        {repaymentSaving ? "Saving..." : "Save repayment"}
      </button>
    </div>
  )}

  <div className="repayment-history">
    <h3>Repayment history</h3>

    {settlements.length === 0 ? (
      <p>No repayments recorded yet.</p>
    ) : (
      settlements
  .slice(0, showAllRepayments ? settlements.length : 5)
  .map((settlement) => {
        const payer = householdMembers.find(
          (member) => member.user_id === settlement.paid_by
        );
        const receiver = householdMembers.find(
          (member) => member.user_id === settlement.paid_to
        );

        return (
          <div key={settlement.id} className="repayment-item">
            <div>
              <strong>
                {payer?.display_name ?? "Household member"} →{" "}
                {receiver?.display_name ?? "Household member"}
              </strong>
              <p>
                {settlement.settled_on ?? "Date not specified"}
                {settlement.note ? ` · ${settlement.note}` : ""}
              </p>
              <small>{settlement.status}</small>
            </div>
            <strong>{money(Number(settlement.amount))}</strong>
          </div>
        );
      })
    )}

{settlements.length > 5 && (
  <button
    type="button"
    className="text-link repayment-view-all"
    onClick={() => setShowAllRepayments((current) => !current)}
  >
    {showAllRepayments ? "Show less ↑" : "View all repayments →"}
  </button>
)}

  </div>
</section>

<section className="panel month-comparison redesigned-month-comparison">
  <div className="month-comparison-heading">
    <div>
      <p className="eyebrow">MONTHLY COMPARISON</p>
      <h2>{currentMonthLabel} vs {previousMonthLabel}</h2>
    </div>
    <input
    type="month"
    value={comparisonMonth}
    onChange={(event) => setComparisonMonth(event.target.value)}
  />
  </div>

  <div className="month-comparison-grid">
    <article className="month-comparison-item income-comparison">
      <div className="comparison-item-heading">
        <span className="comparison-icon">↗</span>
        <span>Income change</span>
      </div>
      <strong className="comparison-amount">
        {householdIncomeChange > 0 ? "+" : householdIncomeChange < 0 ? "−" : ""}
        {money(Math.abs(householdIncomeChange))}
      </strong>
      <p>
        {householdPreviousMonthIncome > 0
          ? `${householdIncomeChange > 0 ? "+" : ""}${(
              (householdIncomeChange / householdPreviousMonthIncome) * 100
            ).toFixed(1)}% compared with last month`
          : "No previous-month income to compare"}
      </p>
    </article>

    <article className="month-comparison-item expense-comparison">
      <div className="comparison-item-heading">
        <span className="comparison-icon">↘</span>
        <span>Expense change</span>
      </div>
      <strong className="comparison-amount">
        {householdExpensesChange > 0 ? "+" : householdExpensesChange < 0 ? "−" : ""}
        {money(Math.abs(householdExpensesChange))}
      </strong>
      <p>
        {householdPreviousMonthExpenses > 0
          ? `${householdExpensesChange > 0 ? "+" : ""}${(
              (householdExpensesChange / householdPreviousMonthExpenses) * 100
            ).toFixed(1)}% compared with last month`
          : "No previous-month expenses to compare"}
      </p>
    </article>
  </div>
</section>
            </>
          )}

          {tab !== "Settings" && (tab === "My Finance" || personal) && (
            <>
              <section className="personal-hero">
                <div>
                  <span className="banner-kicker">JUST FOR YOU 🌷</span>
                  <h2>A fresh start, at your own pace.</h2>
                  <p>Your money, your choices, your private space.</p>
                </div>
                <div className="personal-flower">🌷</div>
              </section>

              <section className="summary-grid personal-summaries">
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon income-icon">↗</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Personal income</p>
                  <h3>{money(totalIncome)}</h3>
                  <span className="summary-foot">Money coming in</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon expense-icon">↘</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Personal expenses</p>
                  <h3>{money(totalExpenses)}</h3>
                  <span className="summary-foot">Money going out</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon difference-icon">♡</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Income minus expenses</p>
                  <h3>{money(totalIncome - totalExpenses)}</h3>
                  <span className="summary-foot">Your monthly difference</span>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">YOUR FINANCIAL JOURNEY</span><h2>My savings goals</h2></div>
                    <span className="panel-emoji">🌱</span>
                  </div>
                  <div className="empty-chart">
                    <div className="empty-chart-icon">🐣</div>
                    <strong>Every little bit counts</strong>
                    <span>Create a private savings goal when you're ready.</span>
                  </div>
                </article>
                <article className="panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">JUST YOURS</span><h2>Recent transactions</h2></div>
                    <button className="subtle-button" onClick={() => setTab("Activity")}>View all →</button>
                  </div>
                  <TransactionList items={visibleTransactions.slice(0, 4)} 
                  onSelectTransaction={setSelectedTransaction}
                  />
                </article>
              </section>
            </>
          )}

          {tab === "Settings" && (
            <section className="settings-workspace">
              <aside className="settings-nav-panel">
                <h1>Settings</h1>
                <nav aria-label="Settings sections">
                  <button type="button" className={settingsSection === "profile" ? "active" : ""} onClick={() => setSettingsSection("profile")}><span className="settings-nav-icon">⚙️</span><span><strong>My Profile</strong><small>Account, email and security</small></span><b>›</b></button>
                  <button type="button" className={settingsSection === "households" ? "active" : ""} onClick={() => setSettingsSection("households")}><span className="settings-nav-icon">🏡</span><span><strong>Household Management</strong><small>Manage your households, members and settings</small></span><b>›</b></button>
                  <button type="button" className={settingsSection === "personal" ? "active" : ""} onClick={() => setSettingsSection("personal")}><span className="settings-nav-icon">👤</span><span><strong>Personal Finance</strong><small>Your private money space</small></span><b>›</b></button>
                </nav>
              </aside>
              <div className="settings-detail-area">
                {settingsSection === "profile" && (
                  <div className="settings-section-content">
                    <div className="settings-section-heading"><h2>My Profile</h2><p>Your account details and how your name appears in the app.</p></div>
              <section className="panel settings-profile-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">PROFILE</span>
                    <h2>My profile</h2>
                    <p className="welcome-description">Your account details and how your name appears in the app.</p>
                  </div>
                  <span className="panel-emoji">🌷</span>
                </div>
                <div className="profile-details">
                  <div className="profile-name-field">
                    <label htmlFor="settings-display-name">Display name</label>
                    <input
                      id="settings-display-name"
                      type="text"
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        setProfileMessage("");
                      }}
                      placeholder="Enter your display name"
                    />
                  </div>
                  <div className="profile-email-card">
                    <span>Email address</span>
                    <strong>{session?.user?.email || "No email available"}</strong>
                  </div>
                </div>
                <div className="profile-actions">
                  <button className="primary-button" onClick={() => void handleSaveProfile()}>Save profile</button>
                  {profileMessage && <p role="status" className="profile-save-message">{profileMessage}</p>}
                </div>
              </section>
                  </div>
                )}
                {settingsSection === "households" && (
                  <div className="settings-section-content">
                    <div className="settings-section-heading"><h2>Household Management</h2><p>Create, edit and manage your households.</p></div>
              <section className="panel household-management-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">YOUR SHARED SPACES</span>
                    <h2>Household Management</h2>
                    <p className="welcome-description">Create, edit and manage your households.</p>
                  </div>
                </div>
                <div className="household-picker-heading">
                  <strong>Your Households</strong>
                  <button className="primary-button" type="button" onClick={() => setShowCreateHousehold(true)}>＋ Create Household</button>
                </div>
                <div className="household-picker-grid">
                  {households.map((home) => (
                    <button type="button" key={home.id} className={`household-choice ${activeHouseholdId === home.id ? "selected" : ""}`} onClick={() => setActiveHouseholdId(home.id)}>
                      <span className="household-choice-icon">{householdIconDisplay(home.icon)}</span>
                      <span><strong>{home.name}</strong><small>{home.memberCount} members</small></span>
                      {activeHouseholdId === home.id && <span className="household-check">✓</span>}
                    </button>
                  ))}
                </div>
                {showCreateHousehold && (
                  <div className="household-create-row">
                    <input value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} placeholder="e.g. Family Home" />
                    <button type="button" className="primary-button" disabled={householdSaving || !newHouseholdName.trim()} onClick={() => void createHousehold()}>{householdSaving ? "Creating..." : "Create"}</button>
                    <button type="button" className="secondary-button" onClick={() => setShowCreateHousehold(false)}>Cancel</button>
                  </div>
                )}
                {activeHouseholdId && (
                  <div className="household-detail-card">
                    <div className="household-detail-heading">
                      <span className="household-large-icon">{householdIconDisplay(householdIconDraft)}</span>
                      <div><h3>{households.find((h) => h.id === activeHouseholdId)?.name}</h3><p>Household · {households.find((h) => h.id === activeHouseholdId)?.memberCount ?? 0} members</p></div>
                      <span className="household-active-pill">Active</span>
                    </div>
                    <div className="household-tabs">
                      {([["general","⚙️","General"],["members","👥","Members"],["invitations","✉️","Invitations"],["permissions","🛡️","Permissions"]] as const).map(([key, icon, label]) => (
                        <button type="button" key={key} className={householdSettingsTab === key ? "selected" : ""} onClick={() => setHouseholdSettingsTab(key)}><span>{icon}</span>{label}</button>
                      ))}
                    </div>
                    {householdSettingsTab === "general" && (
                      <div className="household-general-fields">
                        <label><span><strong>Household Name</strong><small>The name of your shared space.</small></span><input value={householdNameDraft} onChange={(e) => setHouseholdNameDraft(e.target.value)} /></label>
                        <div className="household-icon-field"><span><strong>Household Icon</strong><small>Choose an icon for this household.</small></span><div>{["🏡","💗","🌱","☕","🐾","🧳","🏢","🏠"].map((icon) => <button type="button" key={icon} className={householdIconDraft === icon ? "selected" : ""} onClick={() => setHouseholdIconDraft(icon)}>{icon}</button>)}</div></div>
                        <button type="button" className="primary-button household-save-button" disabled={householdSaving} onClick={() => void saveHouseholdDetails()}>{householdSaving ? "Saving..." : "Save changes"}</button>
                      </div>
                    )}
                    {householdSettingsTab === "members" && (
                      <div className="household-members-list">
                        <div className="household-members-title"><div><strong>Household Members</strong><small>Member names and avatars belong to this household only.</small></div></div>
                        {householdMembers.map((member) => (
                          <div className={`household-member-row ${memberEditId === member.user_id ? "is-editing" : ""}`} key={member.user_id}>
                            <span className="household-member-avatar">{member.avatar || (member.user_id === session.user.id ? "🐻" : "🐰")}</span>
                            {memberEditId === member.user_id ? (
                              <div className="member-edit-fields"><input value={memberNameDraft} onChange={(e) => setMemberNameDraft(e.target.value)} /><div>{["🐻","🐰","🐱","🐶","🦊","🐼","🐸","🐨"].map((avatar) => <button type="button" key={avatar} className={memberAvatarDraft === avatar ? "selected" : ""} onClick={() => setMemberAvatarDraft(avatar)}>{avatar}</button>)}</div><button type="button" className="primary-button" onClick={() => void saveMemberIdentity(member.user_id)}>Save</button></div>
                            ) : <><div className="household-member-info"><strong>{member.display_name}</strong><small>{member.role === "owner" ? "♛ Owner" : "Member"}</small></div><button type="button" className="secondary-button" onClick={() => { setMemberEditId(member.user_id); setMemberNameDraft(member.display_name); setMemberAvatarDraft(member.avatar || (member.user_id === session.user.id ? "🐻" : "🐰")); }}>✎ Edit</button></>}
                          </div>
                        ))}
                      </div>
                    )}
                    {householdSettingsTab === "invitations" && (
                      <div className="household-invitation-panel"><strong>Invite a Member</strong><p>Enter their email address to create a household invitation.</p><div><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="partner@example.com" /><button type="button" className="primary-button" onClick={() => void createHouseholdInvitation()}>＋ Invite Member</button></div>{inviteMessage && <small role="status">{inviteMessage}</small>}</div>
                    )}
                    {householdSettingsTab === "permissions" && (
                      <div className="household-invitation-panel"><strong>Household Permissions</strong><p>Owners manage household details and invitations. Members can view shared finances and manage their own household identity.</p><small>Your current role: {households.find((h) => h.id === activeHouseholdId)?.role}</small></div>
                    )}
                    {householdMessage && <p className="household-status-message" role="status">{householdMessage}</p>}
                  </div>
                )}
              </section>
                  </div>
                )}
                {settingsSection === "personal" && (
                  <div className="settings-section-content">
                    <div className="settings-section-heading"><h2>Personal Finance</h2><p>Manage the settings for your private money space.</p></div>
                    <section className="panel settings-personal-panel">
                      <div className="preference-row"><span className="preference-icon">🔒</span><div><strong>Personal finance privacy</strong><small>Your personal records are visible only to you and are separate from household finances.</small></div><span className="preference-value privacy-value">Private</span></div>
                    </section>
                  </div>
                )}
                {settingsSection === "households" && (
                  <div className="settings-section-content household-preferences-content">
              <section className="panel settings-preferences-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">HOUSEHOLD SETTINGS</span>
                    <h2>Finance preferences</h2>
                    <p className="welcome-description">Manage currency, privacy and categories for your finances.</p>
                  </div>
                  <span className="panel-emoji">💜</span>
                </div>
                <div className="preference-list">
                  <div className="preference-row">
                    <span className="preference-icon">฿</span>
                    <div><strong>Currency</strong><small>Default currency for your records</small></div>
                    <span className="preference-value">THB · Thai Baht</span>
                  </div>
                  <div className="preference-row">
                    <span className="preference-icon">🔒</span>
                    <div><strong>Personal finance privacy</strong><small>Your personal records are visible only to you</small></div>
                    <span className="preference-value privacy-value">Private</span>
                  </div>
                </div>
              </section>

              <section className="panel category-management">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">CUSTOMIZE YOUR FINANCES</span>
                    <h2>Category management</h2>
                    <p className="welcome-description">
                      Manage the categories shared by Household and Personal Finance.
                    </p>
                  </div>
                  <span className="panel-emoji">🗂️</span>
                </div>

                <div className="category-toolbar">
                  <div className="category-kind-tabs">
                    <button type="button" className={categoryKindTab === "expense" ? "selected" : ""} onClick={() => { setCategoryKindTab("expense"); resetCategoryForm(); setExpandedCategoryIds([]); }}>Expenses</button>
                    <button type="button" className={categoryKindTab === "income" ? "selected" : ""} onClick={() => { setCategoryKindTab("income"); resetCategoryForm(); setExpandedCategoryIds([]); }}>Income</button>
                  </div>
                  <button type="button" className="primary-button category-add-main" onClick={() => { resetCategoryForm(); setShowCategoryEditor(true); }}><span>＋</span> Add category</button>
                </div>

                {showCategoryEditor && (
                  <div className="category-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) resetCategoryForm(); }}>
                    <form className="category-editor category-editor-modal" onSubmit={(event) => void saveCategory(event)}>
                      <div className="category-editor-heading">
                        <div><strong>{editingCategoryId ? "Edit category" : categoryFormParentId ? "Add subcategory" : "Add category"}</strong><p>Choose an icon and give your category a name.</p></div>
                        <button type="button" className="category-modal-close" aria-label="Close" onClick={resetCategoryForm}>×</button>
                      </div>
                      <div className="category-editor-fields">
                        <label><span>Icon</span><input value={categoryFormIcon} onChange={(event) => setCategoryFormIcon(event.target.value)} maxLength={8} aria-label="Category icon" /></label>
                        <label className="category-name-field"><span>Category name</span><input value={categoryFormName} onChange={(event) => setCategoryFormName(event.target.value)} placeholder="e.g. Food & Dining" maxLength={60} autoFocus /></label>
                        <label><span>Main category</span><select value={categoryFormParentId} onChange={(event) => setCategoryFormParentId(event.target.value)}><option value="">None (Main category)</option>{categories.filter((item) => item.kind === categoryKindTab && item.parent_id === null && item.id !== editingCategoryId).map((item) => <option key={item.id} value={item.id}>{item.icon || "📁"} {item.name}</option>)}</select></label>
                      </div>
                      <div className="category-editor-actions"><button type="button" className="secondary-button" onClick={resetCategoryForm}>Cancel</button><button className="primary-button" type="submit" disabled={categorySaving}>{categorySaving ? "Saving..." : editingCategoryId ? "Save changes" : "Add category"}</button></div>
                    </form>
                  </div>
                )}

                {categoryMessage && <p className="category-message" role="status">{categoryMessage}</p>}
                {categoryLoading ? <p className="welcome-description">Loading categories...</p> : (
                  <div className="category-tree">
                    {categories.filter((item) => item.kind === categoryKindTab && item.parent_id === null).map((parent) => {
                      const children = categories.filter((child) => child.parent_id === parent.id);
                      const isExpanded = expandedCategoryIds.includes(parent.id);
                      return (
                        <div className={`category-group ${!parent.is_active ? "inactive" : ""} ${isExpanded ? "expanded" : "collapsed"}`} key={parent.id}>
                          <div className="category-group-heading">
                            <button type="button" className="category-expand-button" aria-label={isExpanded ? "Collapse category" : "Expand category"} onClick={() => setExpandedCategoryIds((current) => isExpanded ? current.filter((id) => id !== parent.id) : [...current, parent.id])}><span className={isExpanded ? "chevron expanded" : "chevron"}>›</span></button>
                            <span className="category-icon">{parent.icon || "📁"}</span>
                            <button type="button" className="category-parent-title" onClick={() => setExpandedCategoryIds((current) => isExpanded ? current.filter((id) => id !== parent.id) : [...current, parent.id])}><strong>{parent.name}</strong><small>{children.length} {children.length === 1 ? "subcategory" : "subcategories"}{!parent.is_active ? " · Inactive" : ""}</small></button>
                            <div className="category-menu-wrap"><button type="button" className="category-menu-trigger" aria-label={`Actions for ${parent.name}`} onClick={() => setOpenCategoryMenuId(openCategoryMenuId === parent.id ? null : parent.id)}>•••</button>{openCategoryMenuId === parent.id && <div className="category-action-menu"><button type="button" onClick={() => startEditCategory(parent)}>✎ <span>Edit</span></button><button type="button" onClick={() => { void toggleCategoryActive(parent); setOpenCategoryMenuId(null); }}>{parent.is_active ? "◉" : "◎"} <span>{parent.is_active ? "Deactivate" : "Activate"}</span></button></div>}</div>
                          </div>
                          {isExpanded && <div className="category-children">
                            {children.map((child) => <div className={`category-row subcategory-row ${!child.is_active ? "inactive" : ""}`} key={child.id}><span className="category-icon">{child.icon || "•"}</span><div className="category-row-name"><strong>{child.name}</strong>{!child.is_active && <small>Inactive</small>}</div><span className={`category-active-dot ${child.is_active ? "on" : "off"}`} title={child.is_active ? "Active" : "Inactive"} /><div className="category-menu-wrap"><button type="button" className="category-menu-trigger" aria-label={`Actions for ${child.name}`} onClick={() => setOpenCategoryMenuId(openCategoryMenuId === child.id ? null : child.id)}>•••</button>{openCategoryMenuId === child.id && <div className="category-action-menu"><button type="button" onClick={() => startEditCategory(child)}>✎ <span>Edit</span></button><button type="button" onClick={() => { void toggleCategoryActive(child); setOpenCategoryMenuId(null); }}>{child.is_active ? "◉" : "◎"} <span>{child.is_active ? "Deactivate" : "Activate"}</span></button></div>}</div></div>)}
                            <button type="button" className="add-subcategory-link" onClick={() => { resetCategoryForm(); setCategoryFormParentId(parent.id); setCategoryFormName(""); setCategoryFormIcon("•"); setShowCategoryEditor(true); }}>＋ Add subcategory</button>
                          </div>}
                        </div>
                      );
                    })}
                    {categories.filter((item) => item.kind === categoryKindTab && item.parent_id === null).length === 0 && <div className="empty-chart"><span className="empty-chart-icon">🗂️</span><strong>No categories yet</strong><span>Add your first main category above.</span></div>}
                  </div>
                )}
                <p className="category-footnote">Renaming keeps existing transactions linked to the category. Deactivated categories remain in your history but are hidden from new entries. Categories are not permanently deleted.</p>
              </section>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "Activity" && (
            <section className="panel activity-panel">
              <div className="activity-heading">
                <div>
                  <span className="section-kicker">YOUR MONEY, IN MOTION</span>
                  <h2>Recent transactions</h2>
                  <p>{filteredTransactions.length} {filteredTransactions.length === 1 ? "record" : "records"}</p>
                </div>
              </div>
              
<input
  className="search-input"
  value={search}
  onChange={(event) => setSearch(event.target.value)}
  placeholder="Search transactions..."
  aria-label="Search transactions"
/>

<div className="activity-filters">
  <div className="activity-type-filters">
    {[
      { label: "All", value: "all" },
      { label: "Expenses", value: "expense" },
      { label: "Income", value: "income" },
    ].map((option) => (
      <button
        key={option.value}
        type="button"
        className={
          activityTypeFilter === option.value
            ? "activity-filter-button active"
            : "activity-filter-button"
        }
        onClick={() =>
          setActivityTypeFilter(
            option.value as "all" | "expense" | "income"
          )
        }
      >
        {option.label}
      </button>
    ))}
  </div>
</div>

<div className="activity-filter-summary">
  <span>
    Filters: Date · Paid by · Category
    {((activityStartDate ? 1 : 0) + (activityEndDate ? 1 : 0) +
      (activityPersonFilter !== "all" ? 1 : 0) + (activityCategoryFilter !== "all" ? 1 : 0)) > 0 && (
      <strong className="activity-filter-active-count">
        {(activityStartDate ? 1 : 0) + (activityEndDate ? 1 : 0) +
          (activityPersonFilter !== "all" ? 1 : 0) + (activityCategoryFilter !== "all" ? 1 : 0)} active
      </strong>
    )}
  </span>
  <button
    type="button"
    className="activity-filter-icon-button"
    onClick={() => setShowActivityFilters(true)}
    aria-label="Open transaction filters"
    aria-haspopup="dialog"
  >
    <span aria-hidden="true">☷</span>
  </button>
</div>

{showActivityFilters && (
  <div className="activity-filter-modal-backdrop" onClick={() => setShowActivityFilters(false)}>
    <section
      className="activity-filter-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-filter-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="activity-filter-modal-heading">
        <div>
          <span className="section-kicker">REFINE YOUR HISTORY</span>
          <h3 id="activity-filter-modal-title">Filters</h3>
        </div>
        <button type="button" className="activity-filter-modal-close" onClick={() => setShowActivityFilters(false)} aria-label="Close filters">×</button>
      </div>

      <div className="activity-filter-modal-fields">
        <div className="activity-date-filters">
          <label>
            <span>From</span>
            <input type="date" value={activityStartDate}
              onChange={(event) => setActivityStartDate(event.target.value)} aria-label="Start date" />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={activityEndDate} min={activityStartDate || undefined}
              onChange={(event) => setActivityEndDate(event.target.value)} aria-label="End date" />
          </label>
        </div>
        {!personal && (
          <div className="activity-person-filter">
            <label htmlFor="activity-person-select">Paid by</label>
            <select id="activity-person-select" className="activity-category-select"
              value={activityPersonFilter} onChange={(event) => setActivityPersonFilter(event.target.value)}>
              <option value="all">Everyone</option>
              {householdMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_id === session?.user.id ? `Me (${member.display_name})` : member.display_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="activity-category-filter">
          <label htmlFor="activity-category-select">Category</label>
          <select id="activity-category-select" className="activity-category-select"
            value={activityCategoryFilter} onChange={(event) => setActivityCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {[...new Set(visibleTransactions.map((item) => item.category))].sort().map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="activity-filter-modal-actions">
        <button type="button" className="activity-clear-filters" onClick={() => {
          setActivityStartDate(""); setActivityEndDate("");
          setActivityPersonFilter("all"); setActivityCategoryFilter("all");
        }}>Clear all</button>
        <button type="button" className="primary-button" onClick={() => setShowActivityFilters(false)}>Show {filteredTransactions.length} results</button>
      </div>
    </section>
  </div>
)}

<TransactionList
   items={filteredTransactions}
   householdMembers={householdMembers}
   currentUserId={session?.user.id ?? ""}
   onSelectTransaction={setSelectedTransaction}
   />

              {filteredTransactions.length === 0 && <p className="empty-message">No matching transactions yet.</p>}
            </section>
          )}

          {tab === "Reports" && (
  <section className="panel reports-panel">
    <div className="reports-header">
      <div>
        <span className="section-kicker">MONTHLY FINANCIAL REPORT</span>
        <h2>Our Reports</h2>
        <p className="welcome-description">
          A clear picture of your money this month.
        </p>
      </div>
      <div className="report-header-icon">📈</div>
    </div>

    {/* Month selector */}
    <div className="report-month-selector">
      <button
        type="button"
        onClick={() => {
          const date = new Date(
            selectedMonthDate.getFullYear(),
            selectedMonthDate.getMonth() - 1,
            1
          );
          setComparisonMonth(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          );
        }}
        aria-label="Previous month"
      >
        ‹
      </button>

      <strong>{currentMonthLabel}</strong>

      <button
        type="button"
        onClick={() => {
          const date = new Date(
            selectedMonthDate.getFullYear(),
            selectedMonthDate.getMonth() + 1,
            1
          );
          setComparisonMonth(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          );
        }}
        aria-label="Next month"
      >
        ›
      </button>
    </div>

    {/* Summary cards */}
    <div className="report-summary-grid">
      <div className="report-summary-card income-card">
        <span>↗ TOTAL INCOME</span>
        <strong>{money(reportIncome)}</strong>
        <small>This month</small>
      </div>

      <div className="report-summary-card expense-card">
        <span>↘ TOTAL EXPENSES</span>
        <strong>{money(reportExpenses)}</strong>
        <small>This month</small>
      </div>

      <div className="report-summary-card report-balance-card">
        <span>REMAINING BALANCE</span>
        <strong>{money(reportBalance)}</strong>
        <small>Income minus expenses</small>
      </div>
    </div>

    {/* Expense breakdown */}
    <div className="report-section report-chart-section">
      <div className="report-section-heading">
        <h3>Expense breakdown</h3>
        <span>By category</span>
      </div>

      {reportCategoryEntries.length === 0 ? (
        <div className="empty-chart">
          <strong>No expenses yet</strong>
          <span>Your category breakdown will appear here.</span>
        </div>
      ) : (
        <div className="report-donut-layout">
          <div
            className="report-donut"
            style={{
              background: `conic-gradient(${reportCategoryEntries.map(
                ([, amount], index) => {
                  const colors = [
                    "#9670bd",
                    "#e99ab4",
                    "#f0b184",
                    "#a8cdb8",
                    "#8db9cf",
                    "#c5a8d9",
                  ];
                  const previousTotal = reportCategoryEntries
                    .slice(0, index)
                    .reduce((sum, item) => sum + item[1], 0);
                  const start = reportExpenses > 0
                    ? (previousTotal / reportExpenses) * 100
                    : 0;
                  const end = reportExpenses > 0
                    ? ((previousTotal + amount) / reportExpenses) * 100
                    : 0;
                  return `${colors[index % colors.length]} ${start}% ${end}%`;
                }
              ).join(", ")})`,
            }}
          >
            <div className="report-donut-hole" />
          </div>

          <div className="report-category-legend">
            {reportCategoryEntries.map(
              ([category, amount], index) => {
              const colors = [
                "#9670bd",
                "#e99ab4",
                "#f0b184",
                "#a8cdb8",
                "#8db9cf",
                "#c5a8d9",
              ];

              return (
                <div className="report-legend-item" key={category}>
                  <span
                    className="report-legend-dot"
                    style={{ background: colors[index % colors.length] }}
                  />
                  <span>{category}</span>
                  <strong>{money(amount)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    {/* Monthly comparison */}
    <div className="report-section">
      <h3>Monthly comparison</h3>
      <p className="report-section-description">
        Compare this month with last month.
      </p>

      {[
        {
          label: "Income",
          change: reportIncomeChange,
          current: reportIncome,
          previous: reportPreviousIncome,
          color: "#9670bd",
          track: "#f0e8f8",
        },
        {
          label: "Expenses",
          change: reportExpensesChange,
          current: reportExpenses,
          previous: reportPreviousExpenses,
          color: "#e28b62",
          track: "#fff0e9",
        },
      ].map((item) => {
        const max = Math.max(item.current, item.previous, 1);
        const width = (item.current / max) * 100;
        const percentage = item.previous > 0
          ? (item.change / item.previous) * 100
          : null;

        return (
          <div className="report-comparison-item" key={item.label}>
            <div className="report-comparison-top">
              <span>{item.label}</span>
              <strong style={{ color: item.color }}>
                {percentage === null
                  ? "No previous data"
                  : `${item.change > 0 ? "↑" : item.change < 0 ? "↓" : "→"} ${Math.abs(percentage).toFixed(1)}%`}
              </strong>
            </div>
            <div
              className="report-comparison-track"
              style={{ background: item.track }}
            >
              <div
                className="report-comparison-fill"
                style={{
                  width: `${width}%`,
                  background: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>

    {/* Household settlements */}
    {!personal && (
      <div className="report-section report-settlement-card">
        <h3>Household settlements</h3>
        <strong>
          {money(
            settlements
              .filter(
                (item) =>
                  item.status === "completed" &&
                  item.settled_on?.slice(0, 7) === selectedMonth
              )
              .reduce((sum, item) => sum + Number(item.amount), 0)
          )}
        </strong>
        <p>Repayments recorded this month</p>
        <small>
          Shown separately — not counted as income or expenses.
        </small>
      </div>
    )}

    {/* Export cards — we'll connect the real export actions next */}
    <div className="report-export-grid">
      <button
  type="button"
  className="report-export-card"
  onClick={exportReportCsv}
>
  <span>▦</span>
  <strong>Export CSV</strong>
  <small>Transaction details</small>
</button>

      <button
  type="button"
  className="report-export-card"
  onClick={exportReportPdf}
>
  <span>▤</span>
  <strong>Export PDF</strong>
  <small>Monthly report</small>
</button>
    </div>
  </section>
)}
        </div>
      </main>


      <button className="floating-add" onClick={openAdd} aria-label="Add transaction">＋</button>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowAdd(false);
        }}>
          <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-heading">
              <div>
                <span className="section-kicker">A LITTLE MONEY UPDATE</span>
                <h2 id="add-title">Add a transaction</h2>
              </div>
              <button className="close-button" onClick={() => setShowAdd(false)} aria-label="Close">×</button>
            </div>

            <div className="space-choice">
              <button className={space === "household" ? "selected" : ""} onClick={() => { setSpace("household"); setTab("Home"); }}>💜 Household</button>
              <button className={space === "personal" ? "selected" : ""} onClick={() => { setSpace("personal"); setTab("My Finance"); }}>🌷 Personal · Private</button>
            </div>

            <form onSubmit={saveTransaction} className="add-transaction-form">
              <div className="type-switch">
                <button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => { setKind("expense"); setCategory(""); }}>− Expense</button>
                <button type="button" className={kind === "income" ? "selected" : ""} onClick={() => { setKind("income"); setCategory(""); }}>＋ Income</button>
              </div>

              <div className="transaction-amount-section">
                <label className="form-label" htmlFor="transaction-amount">Amount</label>
                <div className="amount-input-wrap transaction-amount-wrap">
                  <span>฿</span>
                  <input id="transaction-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
                </div>
                <span className="amount-currency-caption">THB</span>
              </div>

              <label className="form-label" htmlFor="transaction-name">Transaction name</label>
              <input id="transaction-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="What was this for?" required />

              <label className="form-label" htmlFor="transaction-category">Category</label>
              <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value)} required>
                <option value="">Choose a category</option>
                {categories.filter((item) => item.kind === kind && item.is_active && item.parent_id === null).map((parent) => {
                  const children = categories.filter((item) => item.parent_id === parent.id && item.is_active);
                  return children.length > 0 ? (
                    <optgroup key={parent.id} label={`${parent.icon || "📁"} ${parent.name}`}>
                      {children.map((child) => <option key={child.id} value={child.id}>{child.icon || "•"} {child.name}</option>)}
                    </optgroup>
                  ) : <option key={parent.id} value={parent.id}>{parent.icon || "📁"} {parent.name}</option>;
                })}
              </select>
              {categories.filter((item) => item.kind === kind && item.is_active && item.parent_id === null).length === 0 && (
                <p className="category-select-hint">No active categories yet. Add one in Settings → Category Management.</p>
              )}

              {space === "household" && kind === "expense" && (
                <section className="household-split-fields add-split-card" aria-label="Household expense split">
                  <div className="split-card-heading">
                    <span className="split-card-icon">♡</span>
                    <div>
                      <strong>Split this expense</strong>
                      <p>Choose who paid and how to share it</p>
                    </div>
                  </div>

                  <label className="form-label" htmlFor="transaction-payer">Paid by</label>
                  <select id="transaction-payer" value={paidBy} onChange={(event) => setPaidBy(event.target.value)} required>
                    <option value="">Choose who paid</option>
                    {householdMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>{member.display_name}</option>
                    ))}
                  </select>

                  <label className="form-label" htmlFor="split-method">Split method</label>
                  <div className="split-method-options" role="group" aria-label="Split method">
                    <button type="button" className={splitMethod === "equal" ? "selected" : ""} onClick={() => setSplitMethod("equal")}>Equal</button>
                    <button type="button" className={splitMethod === "percentage" ? "selected" : ""} onClick={() => setSplitMethod("percentage")}>Percentage</button>
                    <button type="button" className={splitMethod === "custom" ? "selected" : ""} onClick={() => setSplitMethod("custom")}>Custom amount</button>
                  </div>

                  {splitMethod !== "equal" && (
                    <div className="split-input-list">
                      <p className="split-input-caption">{splitMethod === "percentage" ? "Enter each person's percentage" : "Enter each person's share"}</p>
                      {householdMembers.map((member) => (
                        <div className="split-input-row" key={member.user_id}>
                          <label htmlFor={`share-${member.user_id}`}>{member.display_name}</label>
                          <div className="split-value-input">
                            <input
                              id={`share-${member.user_id}`}
                              type="number"
                              min="0"
                              max={splitMethod === "percentage" ? "100" : undefined}
                              step="0.01"
                              value={shareAmounts[member.user_id] ?? ""}
                              onChange={(event) => setShareAmounts((current) => ({ ...current, [member.user_id]: event.target.value }))}
                              placeholder="0"
                              required
                            />
                            <span>{splitMethod === "percentage" ? "%" : "฿"}</span>
                          </div>
                        </div>
                      ))}
                      <p className="form-hint">
                        {splitMethod === "custom" ? "All shares must add up to the total expense." : "All percentages must add up to 100%."}
                      </p>
                    </div>
                  )}

                  <div className="share-summary-card">
                    <div className="share-summary-title">Share summary</div>
                    {householdMembers.length === 0 ? (
                      <p className="form-hint">No household members found.</p>
                    ) : householdMembers.map((member, index) => {
                      const total = Number(amount) || 0;
                      const raw = Number(shareAmounts[member.user_id] ?? 0);
                      const shareValue = splitMethod === "equal"
                        ? (householdMembers.length ? Math.floor(Math.round(total * 100) / householdMembers.length + (index < Math.round(total * 100) % householdMembers.length ? 1 : 0)) / 100 : 0)
                        : splitMethod === "percentage" ? total * raw / 100 : raw;
                      return (
                        <div className="share-summary-row" key={member.user_id}>
                          <span>{member.display_name}{member.user_id === paidBy ? " · paid" : ""}</span>
                          <strong>฿{shareValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <details className="optional-details">
                <summary>＋ Additional details</summary>
                <label className="form-label" htmlFor="transaction-note">Note</label>
                <textarea id="transaction-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note..." rows={2} />
                <p className="form-hint">The transaction date is set automatically.</p>
              </details>

              {saveError && <p className="auth-error" role="alert">{saveError}</p>}

              <button className="primary-button save-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save ♡"}
              </button>

              <p className="privacy-note">
                🔒 {space === "personal" ? "Private transactions are saved to your account." : "Household transactions are shared with household members."}
              </p>
            </form>
          </section>
        </div>
      
      )}

      {selectedTransaction && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTransaction(null);
            }
          }}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-details-title"
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">
                  TRANSACTION DETAILS
                </span>
                <h2 id="transaction-details-title">
                  {selectedTransaction.name}
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() => setSelectedTransaction(null)}
                aria-label="Close transaction details"
              >
                ×
              </button>
            </div>

            
{isEditingTransaction ? (
  <div className="transaction-edit-form">
    <label>
      Transaction name
      <input
        type="text"
        value={editName}
        onChange={(event) => setEditName(event.target.value)}
      />
    </label>

    <label>
      Notes
      <textarea
        value={editNotes}
        onChange={(event) => setEditNotes(event.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
      />
    </label>

    <label>
      Amount (฿)
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={editAmount}
        onChange={(event) => setEditAmount(event.target.value)}
      />
    </label>

    <label className="transaction-edit-category-field">
      Category
      <select
        className="transaction-edit-category-select"
        value={editCategory}
        onChange={(event) => setEditCategory(event.target.value)}
        required
        aria-label="Select transaction category"
      >
        <option value="">Choose a category</option>
        {categories
          .filter((item) =>
            item.kind === selectedTransaction.type &&
            item.parent_id === null &&
            (item.is_active ||
              item.id === editCategory ||
              categories.some((child) =>
                child.parent_id === item.id && child.id === editCategory
              ))
          )
          .map((parent) => {
            const children = categories.filter((item) =>
              item.parent_id === parent.id &&
              (item.is_active || item.id === editCategory)
            );

            return children.length > 0 ? (
              <optgroup key={parent.id} label={`${parent.icon || "📁"} ${parent.name}`}>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.icon || "•"} {child.name}{!child.is_active ? " · Inactive" : ""}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={parent.id} value={parent.id}>
                {parent.icon || "📁"} {parent.name}{!parent.is_active ? " · Inactive" : ""}
              </option>
            );
          })}
      </select>
      <small className="category-select-hint">
        Choose from your categories in Settings.
      </small>
    </label>

    <label>
      Date
      <input
        type="date"
        value={editDate}
        onChange={(event) => setEditDate(event.target.value)}
      />
    </label>

    
{editError && (
  <p className="form-error" role="alert">
    {editError}
  </p>
)}

<div className="transaction-edit-actions">
  <button
    className="secondary-button"
    type="button"
    disabled={savingEdit}
    onClick={() => {
      setIsEditingTransaction(false);
      setEditError("");
    }}
  >
    Cancel
  </button>

  <button
    className="primary-button"
    type="button"
    disabled={savingEdit}
    onClick={handleSaveTransactionEdit}
  >
    {savingEdit ? "Saving..." : "Save Changes"}
  </button>
</div>
  </div>
) : (
  <div className="transaction-details-content">
    <p className="transaction-details-amount">
      {selectedTransaction.type === "expense" ? "−" : "+"}
      ฿{selectedTransaction.amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </p>

    <div className="transaction-detail-row">
      <span>Type</span>
      <strong>
        {selectedTransaction.type === "expense" ? "Expense" : "Income"}
      </strong>
    </div>

    <div className="transaction-detail-row">
      <span>Category</span>
      <strong>{selectedTransaction.category}</strong>
    </div>

    <div className="transaction-detail-row">
      <span>Date</span>
      <strong>{selectedTransaction.date}</strong>
    </div>

    <div className="transaction-detail-row">
      <span>Account</span>
      <strong>
        {selectedTransaction.space === "household"
          ? `${householdIconDisplay(activeHousehold?.icon)} ${activeHousehold?.name ?? "Household"}`
          : "🌷 Personal"}
      </strong>
    </div>

    {selectedTransaction.space === "household" &&
      selectedTransaction.type === "expense" && (
        <>
          <div className="transaction-detail-row">
            <span>Paid by</span>
            <strong>
              {householdMembers.find(
                (member) =>
                  member.user_id === selectedTransaction.paidByUserId
              )?.display_name ?? "Unknown"}
            </strong>
          </div>

          <div className="transaction-detail-row">
            <span>Split method</span>
            <strong>
              {selectedTransaction.splitMethod ?? "Not specified"}
            </strong>
          </div>
        </>
      )}
  </div>
)}
            
{!isEditingTransaction && (
  <div className="transaction-detail-actions">
    <button
      className="secondary-button"
      type="button"
      onClick={() => {
        if (!selectedTransaction) return;

        setEditName(selectedTransaction.name);
        setEditAmount(String(selectedTransaction.amount));
        setEditNotes(selectedTransaction.notes ?? "");
        const matchingCategory = categories.find((item) =>
          item.id === selectedTransaction.categoryId &&
          item.kind === selectedTransaction.type
        ) ?? categories.find((item) =>
          item.kind === selectedTransaction.type &&
          item.name === selectedTransaction.category
        );
        setEditCategory(matchingCategory?.id ?? "");
        setEditDate(selectedTransaction.date);
        setEditError("");
        setIsEditingTransaction(true);
      }}
    >
      ✏️ Edit
    </button>

    <button
      className="primary-button"
      type="button"
      onClick={() => setSelectedTransaction(null)}
    >
      Close
    </button>
  </div>
)}
          </section>
        </div>
      )}

    </div>
  );
}

function formatTransactionDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TransactionList({
  items,
  householdMembers = [],
  currentUserId = "",
  onSelectTransaction,
}: {
  items: Transaction[];
  householdMembers?: HouseholdMember[];
  currentUserId?: string;
  onSelectTransaction: (item: Transaction) => void;
}) {
  if (items.length === 0) {
    return <div className="empty-list">No transactions yet. Add your first one when you're ready. 🌷</div>;
  }

  const groupedItems = items.reduce<Record<string, Transaction[]>>((groups, item) => {
    const dateKey = item.date.slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {});

  return (
    <div className="transaction-list">
      {Object.entries(groupedItems).map(([date, dateItems]) => (
        <section className="transaction-date-group" key={date}>
          <h3 className="transaction-date-heading">{formatTransactionDate(date)}</h3>
          {dateItems.map((item) => {
            const isHouseholdExpense = item.space === "household" && item.type === "expense";
            const payer = householdMembers.find((member) => member.user_id === item.paidByUserId);
            const myShare = item.shares?.find((share) => share.userId === currentUserId);
            const partnerShare = item.shares?.find((share) => share.userId !== currentUserId);
            const payerName = item.paidByUserId === currentUserId
              ? "you"
              : payer?.display_name ?? "your partner";

            let balanceMessage = "";
            if (myShare && partnerShare) {
              if (item.paidByUserId === currentUserId) {
                const partnerName = householdMembers.find(
                  (member) => member.user_id === partnerShare.userId
                )?.display_name ?? "Your partner";
                balanceMessage = `${partnerName} owes you ${money(partnerShare.amount)}`;
              } else {
                balanceMessage = `You owe ${payerName} ${money(myShare.amount)}`;
              }
            }

            const splitMethodLabel = item.splitMethod ? ({
              equal: "Split equally",
              custom: "Custom amounts",
              percentage: "By percentage",
              shares: "By shares",
              adjustment: "Adjusted split",
            } as Record<string, string>)[item.splitMethod] ?? item.splitMethod : "Split details";

            return (
              <article className="transaction-entry" key={item.id}>
                <button
                  type="button"
                  className="transaction-row"
                  onClick={() => onSelectTransaction(item)}
                  aria-label={`View ${item.name}, ${money(item.amount)}`}
                >
                  <span className="transaction-icon">{item.icon}</span>
                  <span className="transaction-info">
                    <strong>{item.name}</strong>
                    <span>{item.category}</span>
                  </span>
                  <span className={`transaction-amount ${item.type}`}>
                    {item.type === "income" ? "+" : "−"}{money(item.amount)}
                  </span>
                </button>

                {isHouseholdExpense && item.shares && item.shares.length > 0 && (
                  <div className="transaction-inline-split">
                    <div className="transaction-inline-split-caption">
                      Paid by {payerName} · {splitMethodLabel}
                    </div>
                    <div className="transaction-inline-share-line">
                      {item.shares.map((share) => {
                        const memberName = share.userId === currentUserId
                          ? "You"
                          : householdMembers.find((member) => member.user_id === share.userId)?.display_name ?? "Partner";
                        return `${memberName} ${money(share.amount)}`;
                      }).join(" · ")}
                    </div>
                    {balanceMessage && (
                      <div className="transaction-inline-balance">{balanceMessage}</div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}