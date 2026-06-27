<template>
  <div class="cfm__overlay" @click.self="$emit('cancel')">
    <div class="cfm__form">
      <h2>{{ $t('customers.addTitle') }}</h2>
      <input v-model="form.name"                :placeholder="$t('customers.fields.name')"                class="cfm__input" />
      <input v-model="form.customerNumber"      :placeholder="$t('customers.fields.customerNumber')"      class="cfm__input" />
      <input v-model="form.kvk"                 :placeholder="$t('customers.fields.kvk')"                 class="cfm__input" />
      <input v-model="form.vat"                 :placeholder="$t('customers.fields.vat')"                 class="cfm__input" />
      <input v-model="form.contactPerson"       :placeholder="$t('customers.fields.contactPerson')"       class="cfm__input" />
      <input v-model="form.email"               :placeholder="$t('customers.fields.email')"               class="cfm__input" type="email" />
      <input v-model="form.phone"               :placeholder="$t('customers.fields.phone')"               class="cfm__input" type="tel" />
      <input v-model="form.street"              :placeholder="$t('customers.fields.street')"              class="cfm__input" />
      <div class="cfm__row">
        <input v-model="form.houseNumber"         :placeholder="$t('customers.fields.houseNumber')"         class="cfm__input" />
        <input v-model="form.houseNumberAddition" :placeholder="$t('customers.fields.houseNumberAddition')" class="cfm__input" />
      </div>
      <input v-model="form.postalCode"          :placeholder="$t('customers.fields.postalCode')"          class="cfm__input" />
      <input v-model="form.city"                :placeholder="$t('customers.fields.city')"                class="cfm__input" />
      <input v-model="form.province"            :placeholder="$t('customers.fields.province')"            class="cfm__input" />
      <input v-model="form.country"             :placeholder="$t('customers.fields.country')"             class="cfm__input" />
      <textarea v-model="form.notes"            :placeholder="$t('customers.fields.notes')"               class="cfm__input cfm__textarea" rows="3"></textarea>
      <p v-if="formError" class="cfm__form-error">{{ formError }}</p>
      <div class="cfm__form-actions">
        <button class="cfm__btn cfm__btn--cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
        <button class="cfm__btn cfm__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@gearonimo/core'
import { createCustomer } from '../composables/useCustomers'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'saved', customerId: string): void
  (e: 'cancel'): void
}>()

const saving = ref(false)
const formError = ref('')

function emptyForm() {
  return {
    name: '', customerNumber: '', kvk: '', vat: '', contactPerson: '',
    email: '', phone: '', street: '', houseNumber: '', houseNumberAddition: '',
    postalCode: '', city: '', province: '', country: '', notes: '',
  }
}

const form = ref(emptyForm())

async function save() {
  if (!form.value.name.trim())  { formError.value = t('customers.errors.nameRequired');  return }
  if (!form.value.email.trim()) { formError.value = t('customers.errors.emailRequired'); return }
  saving.value = true
  formError.value = ''
  const f = form.value
  try {
    const id = await createCustomer({
      name: f.name.trim(),
      customer_number: f.customerNumber.trim() || null,
      kvk_number: f.kvk.trim() || null,
      vat_number: f.vat.trim() || null,
      contact_person: f.contactPerson.trim() || null,
      email: f.email.trim(),
      phone: f.phone.trim() || null,
      street: f.street.trim() || null,
      house_number: f.houseNumber.trim() || null,
      house_number_addition: f.houseNumberAddition.trim() || null,
      postal_code: f.postalCode.trim() || null,
      city: f.city.trim() || null,
      province: f.province.trim() || null,
      country: f.country.trim() || null,
      notes: f.notes.trim() || null,
    })
    form.value = emptyForm()
    emit('saved', id)
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.cfm__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; z-index: 100;
}
.cfm__form {
  background: #fff; width: 100%; border-radius: 16px 16px 0 0;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
  max-height: 88vh; overflow-y: auto;
}
.cfm__row { display: flex; gap: 0.75rem; }
.cfm__row .cfm__input { flex: 1; }
.cfm__textarea { font-family: inherit; resize: vertical; }
.cfm__form h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.cfm__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box;
}
.cfm__form-error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.cfm__form-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.cfm__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.cfm__btn--cancel { background: #f3f4f6; color: #374151; }
.cfm__btn--save { background: #16a34a; color: #fff; }
.cfm__btn--save:disabled { opacity: 0.6; }
</style>
