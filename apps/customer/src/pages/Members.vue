<template>
  <div class="mb">
    <header class="mb__header">
      <router-link to="/" class="mb__back">‹ {{ $t('members.back') }}</router-link>
      <h1>{{ $t('members.title') }}</h1>
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
import { ref, onMounted } from "vue";
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

const customerName = ref("");
const inviteCode = ref("");
const isAdmin = ref(false);
const members = ref<MemberRow[]>([]);
const loading = ref(true);
const error = ref("");

const formOpen = ref(false);
const editingId = ref<string | null>(null);
const editingIsMe = ref(false);
const saving = ref(false);
const formError = ref("");
const form = ref({ name: "", role: "", phone: "", email: "", active: true, is_admin: false });

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

    const { data, error: err } = await supabase.rpc("my_members");
    if (err) throw err;
    members.value = (data ?? []) as MemberRow[];
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
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
</style>
