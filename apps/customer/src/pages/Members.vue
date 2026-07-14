<template>
  <div class="mb">
    <header class="mb__header">
      <router-link to="/" class="mb__back">‹ {{ $t('members.back') }}</router-link>
      <!-- De pagina heet "Instellingen" (de tegel op het dashboard); het
           medewerkersbeheer + de uitnodigingscode zijn de inhoud ervan. -->
      <h1>{{ $t('settings.title') }}</h1>
      <span class="mb__spacer"></span>
    </header>

    <div v-if="loading" class="mb__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="mb__state mb__state--error">{{ error }}</div>

    <div v-else class="mb__body">
      <!-- De uitnodigingscode: zo haalt de beheerder collega's binnen. Elke
           collega logt zelf in en koppelt met deze code; de e-mail-hereniging
           in join_customer_by_invite plakt account en medewerker-rij aan
           elkaar als het e-mailadres overeenkomt. -->
      <section v-if="isAdmin && inviteCode" class="mb__invite">
        <div class="mb__invite-text">
          <strong>{{ $t('members.inviteTitle') }}</strong>
          <p>{{ $t('members.inviteHint') }}</p>
        </div>
        <button class="mb__invite-code" :title="$t('members.copy')" @click="copyCode">{{ inviteCode }}</button>
      </section>

      <!-- Bedrijfsgegevens (adres, KvK/BTW, contactpersoon, bedrijfstelefoon/
           -email): tot 2026-07-14 kon alleen de keurmeester dit invullen, via
           het klantformulier in de Pro-app -- voor een klant die zichzelf
           heeft aangemeld (leadmotor) is er dan niemand die dat voor hem
           doet. Alleen de beheerder mag wijzigen; iedereen mag het zien. -->
      <section class="mb__section mb__company">
        <div class="mb__section-head">
          <h2>{{ $t('settings.company.title') }}</h2>
          <button v-if="isAdmin && !companyFormOpen" class="mb__add" @click="openCompanyEdit">{{ $t('settings.company.edit') }}</button>
        </div>

        <dl v-if="!companyFormOpen" class="mb__co-list">
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.email') }}</dt><dd>{{ company.email || '—' }}</dd></div>
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.phone') }}</dt><dd>{{ company.phone || '—' }}</dd></div>
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.contactPerson') }}</dt><dd>{{ company.contact_person || '—' }}</dd></div>
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.kvkNumber') }}</dt><dd>{{ company.kvk_number || '—' }}</dd></div>
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.vatNumber') }}</dt><dd>{{ company.vat_number || '—' }}</dd></div>
          <div class="mb__co-row"><dt>{{ $t('settings.company.fields.address') }}</dt><dd>{{ addressLine || '—' }}</dd></div>
        </dl>

        <form v-else class="mb__form" @submit.prevent="saveCompany">
          <input v-model="companyForm.email" type="email" :placeholder="$t('settings.company.fields.email')" class="mb__input" />
          <input v-model="companyForm.phone" type="tel" :placeholder="$t('settings.company.fields.phone')" class="mb__input" />
          <input v-model="companyForm.contact_person" :placeholder="$t('settings.company.fields.contactPerson')" class="mb__input" />
          <input v-model="companyForm.kvk_number" :placeholder="$t('settings.company.fields.kvkNumber')" class="mb__input" />
          <input v-model="companyForm.vat_number" :placeholder="$t('settings.company.fields.vatNumber')" class="mb__input" />
          <div class="mb__co-row-inputs">
            <input v-model="companyForm.street" :placeholder="$t('settings.company.fields.street')" class="mb__input mb__co-street" />
            <input v-model="companyForm.house_number" :placeholder="$t('settings.company.fields.houseNumber')" class="mb__input mb__co-short" />
            <input v-model="companyForm.house_number_addition" :placeholder="$t('settings.company.fields.addition')" class="mb__input mb__co-short" />
          </div>
          <div class="mb__co-row-inputs">
            <input v-model="companyForm.postal_code" :placeholder="$t('settings.company.fields.postalCode')" class="mb__input mb__co-short" />
            <input v-model="companyForm.city" :placeholder="$t('settings.company.fields.city')" class="mb__input" />
          </div>
          <input v-model="companyForm.province" :placeholder="$t('settings.company.fields.province')" class="mb__input" />
          <input v-model="companyForm.country" :placeholder="$t('settings.company.fields.country')" class="mb__input" />
          <p v-if="companyFormError" class="mb__state mb__state--error">{{ companyFormError }}</p>
          <div class="mb__form-actions">
            <button type="submit" class="mb__save" :disabled="companySaving">{{ $t('members.save') }}</button>
            <button type="button" class="mb__cancel" @click="companyFormOpen = false">{{ $t('members.cancel') }}</button>
          </div>
        </form>
      </section>

      <p v-if="!isAdmin" class="mb__state">{{ $t('members.readOnly') }}</p>

      <section class="mb__section">
        <div class="mb__section-head">
          <h2>{{ customerName }}</h2>
          <button v-if="isAdmin && !formOpen" class="mb__add" @click="openAdd">{{ $t('members.add') }}</button>
        </div>

        <form v-if="formOpen" class="mb__form" @submit.prevent="save">
          <input v-model="form.name" :placeholder="$t('members.fields.name')" class="mb__input" required />
          <input v-model="form.role" :placeholder="$t('members.fields.role')" class="mb__input" />
          <input v-model="form.phone" type="tel" :placeholder="$t('members.fields.phone')" class="mb__input" />
          <input v-model="form.email" type="email" :placeholder="$t('members.fields.email')" class="mb__input" />
          <!-- Vergrendel-vangnet (spiegel van save_my_member): jezelf inactief
               of niet-beheerder maken zou de laatste beheerder buitensluiten. -->
          <label class="mb__check">
            <input type="checkbox" v-model="form.active" :disabled="editingIsMe" />
            {{ $t('members.fields.active') }}
          </label>
          <label class="mb__check">
            <input type="checkbox" v-model="form.is_admin" :disabled="editingIsMe" />
            {{ $t('members.fields.admin') }}
          </label>
          <p v-if="formError" class="mb__state mb__state--error">{{ formError }}</p>
          <div class="mb__form-actions">
            <button type="submit" class="mb__save" :disabled="saving">{{ $t('members.save') }}</button>
            <button type="button" class="mb__cancel" @click="closeForm">{{ $t('members.cancel') }}</button>
          </div>
        </form>

        <p v-if="!members.length" class="mb__state">{{ $t('members.empty') }}</p>
        <ul v-else class="mb__list">
          <li v-for="m in members" :key="m.id" class="mb__item" :class="{ 'mb__item--inactive': !m.active }">
            <div class="mb__item-main">
              <div class="mb__item-name">
                {{ m.name }}
                <span v-if="m.is_me" class="mb__badge mb__badge--me">{{ $t('members.you') }}</span>
                <span v-if="m.is_admin" class="mb__badge">{{ $t('members.badgeAdmin') }}</span>
                <span v-if="!m.active" class="mb__badge mb__badge--muted">{{ $t('members.badgeInactive') }}</span>
                <span v-else-if="!m.has_account" class="mb__badge mb__badge--muted">{{ $t('members.badgeNoAccount') }}</span>
              </div>
              <div class="mb__item-meta">
                {{ [m.role, m.phone, m.email].filter(Boolean).join(' · ') }}
              </div>
            </div>
            <button v-if="isAdmin" class="mb__edit" @click="openEdit(m)">{{ $t('members.edit') }}</button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase, errorMessage } from "@gearonimo/core";

const router = useRouter();

interface MemberRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  is_admin: boolean;
  has_account: boolean;
  is_me: boolean;
}

interface CompanyInfo {
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  street: string | null;
  house_number: string | null;
  house_number_addition: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}
const emptyCompanyForm = (): CompanyInfo => ({
  email: "", phone: "", contact_person: "", kvk_number: "", vat_number: "",
  street: "", house_number: "", house_number_addition: "", postal_code: "",
  city: "", province: "", country: "",
});

const customerName = ref("");
const inviteCode = ref("");
const isAdmin = ref(false);
const members = ref<MemberRow[]>([]);
const company = ref<CompanyInfo>(emptyCompanyForm());
const loading = ref(true);
const error = ref("");

const addressLine = computed(() => {
  const c = company.value;
  const line1 = [c.street, [c.house_number, c.house_number_addition].filter(Boolean).join("")].filter(Boolean).join(" ");
  const line2 = [c.postal_code, c.city].filter(Boolean).join(" ");
  return [line1, line2, c.province, c.country].filter(Boolean).join(", ");
});

const formOpen = ref(false);
const editingId = ref<string | null>(null);
const editingIsMe = ref(false);
const saving = ref(false);
const formError = ref("");
const form = ref({ name: "", role: "", phone: "", email: "", active: true, is_admin: false });

const companyFormOpen = ref(false);
const companySaving = ref(false);
const companyFormError = ref("");
const companyForm = ref<CompanyInfo>(emptyCompanyForm());

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data: cust, error: custErr } = await supabase.rpc("my_customer");
    if (custErr) throw custErr;
    const row = Array.isArray(cust) ? cust[0] : cust;
    if (!row) {
      router.replace("/join");
      return;
    }
    customerName.value = row.customer_name;
    inviteCode.value = row.invite_code ?? "";
    isAdmin.value = !!row.is_admin;
    company.value = {
      email: row.email, phone: row.phone, contact_person: row.contact_person,
      kvk_number: row.kvk_number, vat_number: row.vat_number,
      street: row.street, house_number: row.house_number, house_number_addition: row.house_number_addition,
      postal_code: row.postal_code, city: row.city, province: row.province, country: row.country,
    };

    const { data, error: err } = await supabase.rpc("my_members");
    if (err) throw err;
    members.value = (data ?? []) as MemberRow[];
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

function openCompanyEdit() {
  companyForm.value = {
    email: company.value.email ?? "", phone: company.value.phone ?? "",
    contact_person: company.value.contact_person ?? "",
    kvk_number: company.value.kvk_number ?? "", vat_number: company.value.vat_number ?? "",
    street: company.value.street ?? "", house_number: company.value.house_number ?? "",
    house_number_addition: company.value.house_number_addition ?? "",
    postal_code: company.value.postal_code ?? "", city: company.value.city ?? "",
    province: company.value.province ?? "", country: company.value.country ?? "",
  };
  companyFormError.value = "";
  companyFormOpen.value = true;
}

async function saveCompany() {
  companySaving.value = true;
  companyFormError.value = "";
  try {
    const f = companyForm.value;
    const { error: err } = await supabase.rpc("update_my_customer", {
      p_email: f.email?.trim() || null,
      p_phone: f.phone?.trim() || null,
      p_contact_person: f.contact_person?.trim() || null,
      p_kvk_number: f.kvk_number?.trim() || null,
      p_vat_number: f.vat_number?.trim() || null,
      p_street: f.street?.trim() || null,
      p_house_number: f.house_number?.trim() || null,
      p_house_number_addition: f.house_number_addition?.trim() || null,
      p_postal_code: f.postal_code?.trim() || null,
      p_city: f.city?.trim() || null,
      p_province: f.province?.trim() || null,
      p_country: f.country?.trim() || null,
    });
    if (err) throw err;
    companyFormOpen.value = false;
    await load();
  } catch (e) {
    companyFormError.value = errorMessage(e);
  } finally {
    companySaving.value = false;
  }
}

function openAdd() {
  editingId.value = null;
  editingIsMe.value = false;
  form.value = { name: "", role: "", phone: "", email: "", active: true, is_admin: false };
  formError.value = "";
  formOpen.value = true;
}

function openEdit(m: MemberRow) {
  editingId.value = m.id;
  editingIsMe.value = m.is_me;
  form.value = {
    name: m.name,
    role: m.role ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    active: m.active,
    is_admin: m.is_admin,
  };
  formError.value = "";
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  editingId.value = null;
}

async function save() {
  saving.value = true;
  formError.value = "";
  try {
    const { error: err } = await supabase.rpc("save_my_member", {
      p_id: editingId.value,
      p_name: form.value.name.trim(),
      p_role: form.value.role.trim() || null,
      p_phone: form.value.phone.trim() || null,
      p_email: form.value.email.trim() || null,
      p_active: form.value.active,
      p_is_admin: form.value.is_admin,
    });
    if (err) throw err;
    closeForm();
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
  } catch {
    /* geen clipboard-permissie: de code staat toch in beeld */
  }
}

onMounted(load);
</script>

<style scoped>
.mb { min-height: 100vh; background: #f0f4f8; }
.mb__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.mb__header h1 { font-size: 1.2rem; margin: 0; flex: 1; text-align: center; }
.mb__back { color: #a7c4b0; text-decoration: none; font-size: 0.9rem; white-space: nowrap; }
.mb__spacer { width: 3rem; }
.mb__state { text-align: center; padding: 1.5rem 1rem; color: #666; }
.mb__state--error { color: #dc2626; }
.mb__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }

.mb__invite {
  display: flex; align-items: center; gap: 0.75rem;
  background: #dcfce7; border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.25rem;
}
.mb__invite-text { flex: 1; min-width: 0; }
.mb__invite-text p { margin: 0.25rem 0 0; font-size: 0.85rem; color: #166534; }
.mb__invite-text strong { color: #14532d; }
.mb__invite-code {
  flex: 0 0 auto; font-family: ui-monospace, monospace; font-size: 1.05rem; font-weight: 800;
  background: #fff; color: #166534; border: 1px dashed #16a34a; border-radius: 10px;
  padding: 0.5rem 0.75rem; cursor: pointer; letter-spacing: 0.08em;
}

.mb__section h2 { font-size: 1rem; margin: 0; }
.mb__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.mb__add {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.4rem 0.8rem; font-weight: 700; cursor: pointer; font-size: 0.85rem;
}

.mb__form {
  background: #fff; border-radius: 12px; padding: 1rem; margin-bottom: 0.85rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.mb__input {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem; font-size: 0.95rem;
}
.mb__check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #374151; }
.mb__form-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.mb__save {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.5rem 1rem; font-weight: 700; cursor: pointer;
}
.mb__save:disabled { opacity: 0.5; }
.mb__cancel { background: none; border: none; color: #6b7280; cursor: pointer; }

.mb__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.mb__item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.mb__item:last-child { border-bottom: none; }
.mb__item--inactive .mb__item-name { color: #9ca3af; }
.mb__item-main { min-width: 0; }
.mb__item-name { font-weight: 600; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.mb__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; overflow-wrap: anywhere; }
.mb__badge {
  font-size: 0.7rem; font-weight: 700; border-radius: 999px; padding: 0.15rem 0.5rem;
  background: #dcfce7; color: #166534;
}
.mb__badge--muted { background: #f3f4f6; color: #6b7280; }
.mb__badge--me { background: #dbeafe; color: #1d4ed8; }
.mb__edit {
  flex: 0 0 auto; background: none; border: 1px solid #d1d5db; border-radius: 8px;
  padding: 0.3rem 0.7rem; font-size: 0.8rem; color: #374151; cursor: pointer;
}

.mb__company { margin-bottom: 1.5rem; }
.mb__co-list { background: #fff; border-radius: 12px; padding: 0.25rem 1rem; margin: 0; }
.mb__co-row {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 0.6rem 0; border-bottom: 1px solid #f3f4f6;
}
.mb__co-row:last-child { border-bottom: none; }
.mb__co-row dt { color: #6b7280; font-size: 0.85rem; }
.mb__co-row dd { margin: 0; font-weight: 600; text-align: right; }
.mb__co-row-inputs { display: flex; gap: 0.5rem; }
.mb__co-street { flex: 1; }
.mb__co-short { flex: 0 0 6rem; }
</style>
