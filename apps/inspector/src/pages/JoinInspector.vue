<!-- Uitnodig-knop voor keurmeesters zonder eigen account (Jos, 2026-09-08),
     zelfde patroon als de klant-app-uitnodiging (Join.vue): een korte code
     op de keurmeester-rij (InspectorsSettings.vue toont 'm aan de beheerder),
     hier in te vullen door de uitgenodigde keurmeester zelf.

     Twee gevallen in één scherm: nog geen account (e-mail + wachtwoord erbij,
     `supabase.auth.signUp`) of al ingelogd maar nog niet gekoppeld (bv. na
     het bevestigen van de e-mail als het project dat vereist) -- dan alleen
     nog naam + code. `?code=` vult de code alvast in, ook na de
     bevestigingslink terug (zie redirectTo hieronder). -->
<template>
  <div class="lg">
    <div class="lg__lang"><LangToggle /></div>
    <div class="lg__card">
      <h1 class="lg__brand">Gearonimo Pro</h1>
      <div class="lg__applabel-wrap"><span class="lg__applabel lg__applabel--inspector">{{ $t('login.appLabel') }}</span></div>
      <p class="lg__sub">{{ $t('joinInspector.subtitle') }}</p>

      <div v-if="done" class="lg__sent">
        <p>✅ {{ $t('joinInspector.doneMessage', { company: companyName }) }}</p>
        <button class="lg__btn" @click="router.push('/')">{{ $t('joinInspector.continue') }}</button>
      </div>

      <div v-else-if="pendingConfirmation" class="lg__sent">
        <p>✉️ {{ $t('joinInspector.confirmEmailSent') }}</p>
      </div>

      <form v-else @submit.prevent="handleJoin">
        <template v-if="!isLoggedIn">
          <label class="lg__label">{{ $t('login.email') }}</label>
          <input v-model="email" type="email" required autocomplete="email" class="lg__input" />
          <label class="lg__label">{{ $t('joinInspector.choosePassword') }}</label>
          <input v-model="password" type="password" required minlength="6" autocomplete="new-password" class="lg__input" />
        </template>

        <label class="lg__label">{{ $t('joinInspector.nameLabel') }}</label>
        <input v-model="name" class="lg__input" :placeholder="$t('joinInspector.namePlaceholder')" />

        <label class="lg__label">{{ $t('joinInspector.codeLabel') }}</label>
        <input
          v-model="code"
          required
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          class="lg__input lg__input--code"
          placeholder="bv. 3F8A2C1D"
        />

        <p v-if="error" class="lg__error">{{ error }}</p>

        <button type="submit" class="lg__btn" :disabled="busy">
          {{ busy ? $t('login.busy') : $t('joinInspector.submit') }}
        </button>
      </form>

      <button v-if="!done && !pendingConfirmation" class="lg__link" @click="router.push('/login')">
        {{ $t('joinInspector.backToLogin') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, supabase, errorMessage } from '@gearonimo/core'
import { LangToggle } from '@gearonimo/ui'

const route = useRoute()
const router = useRouter()
const { isLoggedIn, signUpWithEmail } = useAuth()

const email = ref('')
const password = ref('')
const name = ref('')
const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const error = ref('')
const busy = ref(false)
const pendingConfirmation = ref(false)
const done = ref(false)
const companyName = ref('')

async function handleJoin() {
  error.value = ''
  busy.value = true
  try {
    if (!isLoggedIn.value) {
      const redirectTo = `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(code.value.trim())}`
      const data = await signUpWithEmail(email.value, password.value, redirectTo)
      if (!data.session) {
        pendingConfirmation.value = true
        return
      }
    }
    const { data, error: err } = await supabase
      .rpc('join_inspector_by_invite', { p_code: code.value.trim(), p_name: name.value.trim() || null })
      .single()
    if (err) throw err
    companyName.value = (data as { company_name: string | null } | null)?.company_name ?? ''
    done.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.lg {
  min-height: var(--page-min-h, 100vh); background: #f0f4f8;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
  position: relative;
}
.lg__lang { position: absolute; top: 1rem; right: 1rem; }
.lg__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.lg__brand { margin: 0 0 0.5rem; color: #1a3a2a; font-size: 1.6rem; text-align: center; }
.lg__applabel-wrap { text-align: center; margin: 0 0 0.75rem; }
.lg__applabel { display: inline-block; font-size: 0.78rem; font-weight: 600; border-radius: 999px; padding: 0.2rem 0.7rem; }
.lg__applabel--inspector { background: #dcfce7; color: #166534; }
.lg__sub { margin: 0 0 1.25rem; color: #6b7280; text-align: center; font-size: 0.9rem; }
.lg__label { display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem; }
.lg__input {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem;
}
.lg__input--code { text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
.lg__btn {
  width: 100%; padding: 0.9rem; border-radius: 10px; border: none;
  background: #16a34a; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.lg__btn:disabled { opacity: 0.6; }
.lg__link {
  display: block; width: 100%; text-align: center; background: none; border: none;
  color: #16a34a; font-weight: 600; cursor: pointer; margin-top: 0.85rem; font-size: 0.9rem;
}
.lg__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.lg__sent { text-align: center; color: #1a3a2a; }
.lg__sent p { margin: 0 0 1rem; }
</style>
