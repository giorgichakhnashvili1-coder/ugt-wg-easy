<template>
  <main v-if="hostnameSettings">
    <FormElement @submit.prevent="submitPublicIp">
      <FormGroup>
        <FormTextField
          id="serverPublicIp"
          v-model="serverPublicIp"
          :label="$t('admin.hostname.publicIp.label')"
          :description="$t('admin.hostname.publicIp.description')"
          autocomplete="off"
        />
        <p
          v-if="publicIpMessage"
          class="col-span-2 text-sm"
          :class="
            publicIpMessageType === 'error'
              ? 'text-red-800 dark:text-red-400'
              : 'text-green-800 dark:text-green-400'
          "
        >
          {{ publicIpMessage }}
        </p>
      </FormGroup>
      <FormGroup>
        <FormPrimaryActionField type="submit" :label="$t('form.save')" />
      </FormGroup>
    </FormElement>

    <FormElement @submit.prevent="submit">
      <FormGroup>
        <FormTextField
          id="hostname"
          v-model="hostname"
          :label="$t('admin.hostname.label')"
          :description="$t('admin.hostname.description')"
          autocomplete="off"
        />
        <p
          v-if="message"
          class="col-span-2 text-sm"
          :class="
            messageType === 'error'
              ? 'text-red-800 dark:text-red-400'
              : 'text-green-800 dark:text-green-400'
          "
        >
          {{ message }}
        </p>
      </FormGroup>
      <FormGroup>
        <FormHeading>{{ $t('admin.hostname.dns.heading') }}</FormHeading>
        <FormSecondaryActionField
          :label="dnsButtonLabel"
          :disabled="!formatValidation.valid || dnsState === 'checking'"
          @click="checkDns"
        />
        <div
          v-if="dnsState !== 'idle'"
          class="col-span-2 flex items-start gap-2 text-sm"
          :class="dnsBannerClass"
        >
          <IconsLoading
            v-if="dnsState === 'checking'"
            class="mt-0.5 size-4 shrink-0 animate-spin"
          />
          <IconsCheckCircle
            v-else-if="dnsState === 'resolved_match'"
            class="mt-0.5 size-4 shrink-0"
          />
          <IconsWarning v-else class="mt-0.5 size-4 shrink-0" />
          <span>{{ dnsMessage }}</span>
        </div>
      </FormGroup>
      <FormGroup>
        <FormHeading>{{ $t('form.actions') }}</FormHeading>
        <FormPrimaryActionField type="submit" :label="$t('form.save')" />
      </FormGroup>
      <FormGroup v-if="liveStatus !== 'idle'">
        <FormHeading>{{ $t('admin.hostname.live.heading') }}</FormHeading>
        <FormSecondaryActionField
          :label="$t('admin.hostname.live.refresh')"
          :disabled="liveChecking"
          @click="refreshLiveStatusNow"
        />
        <div
          class="col-span-2 flex items-start gap-2 text-sm"
          :class="liveBannerClass"
        >
          <IconsLoading
            v-if="liveChecking"
            class="mt-0.5 size-4 shrink-0 animate-spin"
          />
          <IconsCheckCircle
            v-else-if="liveStatus === 'cert_active'"
            class="mt-0.5 size-4 shrink-0"
          />
          <IconsWarning v-else class="mt-0.5 size-4 shrink-0" />
          <span>{{ liveMessage }}</span>
        </div>
      </FormGroup>
    </FormElement>

    <FormElement @submit.prevent="submitCertificate">
      <FormGroup>
        <FormHeading>{{
          $t('admin.hostname.certificate.heading')
        }}</FormHeading>
        <span class="col-span-2 text-sm text-gray-500 dark:text-neutral-400">
          {{
            certMode === 'custom'
              ? $t('admin.hostname.certificate.modeCustom')
              : $t('admin.hostname.certificate.modeAutomatic')
          }}
        </span>
      </FormGroup>
      <FormGroup>
        <FormLabel for="certFile">
          {{ $t('admin.hostname.certificate.certFileLabel') }}
        </FormLabel>
        <input
          id="certFile"
          type="file"
          accept=".pem,.crt,.cer"
          class="rounded-lg border-2 border-gray-100 text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-gray-700 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 dark:file:bg-neutral-800 dark:file:text-neutral-200"
          @change="onCertFileChange"
        />
        <FormLabel for="keyFile">
          {{ $t('admin.hostname.certificate.keyFileLabel') }}
        </FormLabel>
        <input
          id="keyFile"
          type="file"
          accept=".pem,.key"
          class="rounded-lg border-2 border-gray-100 text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-gray-700 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 dark:file:bg-neutral-800 dark:file:text-neutral-200"
          @change="onKeyFileChange"
        />
        <p
          v-if="certMessage"
          class="col-span-2 text-sm"
          :class="
            certMessageType === 'error'
              ? 'text-red-800 dark:text-red-400'
              : 'text-green-800 dark:text-green-400'
          "
        >
          {{ certMessage }}
        </p>
      </FormGroup>
      <FormGroup>
        <FormPrimaryActionField
          type="submit"
          :disabled="certUploading"
          :label="$t('admin.hostname.certificate.upload')"
        />
        <FormSecondaryActionField
          v-if="certMode === 'custom'"
          :disabled="certUploading"
          :label="$t('admin.hostname.certificate.switchToAutomatic')"
          @click="switchToAutomatic"
        />
      </FormGroup>
    </FormElement>
  </main>
</template>

<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { CertificateSaveResult } from '#shared/utils/certificate';
import { validateHostname } from '#shared/utils/hostname';
import type {
  HostnameDnsCheckResult,
  HostnameLiveStatus,
  HostnameValidationResult,
} from '#shared/utils/hostname';
import type { PublicIpValidationResult } from '#shared/utils/publicIp';

const { t } = useI18n();

const { data: hostnameSettings } = await useFetch('/api/admin/hostname', {
  method: 'get',
});

const hostname = ref(hostnameSettings.value?.hostname ?? '');
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

const serverPublicIp = ref(hostnameSettings.value?.serverPublicIp ?? '');
const publicIpMessage = ref('');
const publicIpMessageType = ref<'success' | 'error'>('success');

const formatValidation = computed(() => validateHostname(hostname.value));

type DnsState =
  | 'idle'
  | 'checking'
  | 'resolved_match'
  | 'resolved_mismatch'
  | 'not_resolved'
  | 'not_configured'
  | 'error';

const dnsState = ref<DnsState>('idle');
const dnsResolvedIps = ref<string[]>([]);

const dnsButtonLabel = computed(() =>
  dnsState.value === 'idle'
    ? t('admin.hostname.dns.check')
    : t('admin.hostname.dns.recheck')
);

const dnsBannerClass = computed(() => {
  switch (dnsState.value) {
    case 'resolved_match':
      return 'text-green-800 dark:text-green-400';
    case 'resolved_mismatch':
      return 'text-red-800 dark:text-red-400';
    case 'not_resolved':
      return 'text-yellow-700 dark:text-yellow-500';
    default:
      return 'text-gray-500 dark:text-neutral-400';
  }
});

const dnsMessage = computed(() => {
  switch (dnsState.value) {
    case 'checking':
      return t('admin.hostname.dns.checking');
    case 'resolved_match':
      return t('admin.hostname.dns.matched');
    case 'not_resolved':
      return t('admin.hostname.dns.notResolved');
    case 'resolved_mismatch':
      return t('admin.hostname.dns.mismatch', {
        ips: dnsResolvedIps.value.join(', '),
      });
    case 'not_configured':
      return t('admin.hostname.dns.notConfigured');
    default:
      return t('admin.hostname.dns.error');
  }
});

type LiveStatus = HostnameLiveStatus['status'] | 'idle';

const liveStatus = ref<LiveStatus>('idle');
const liveIssuer = ref('');
const liveValidTo = ref('');
const liveChecking = ref(false);
const livePollAttempts = ref(0);
const MAX_LIVE_POLL_ATTEMPTS = 12; // ~1 minute at 5s apart

const { pause: pauseLivePolling, resume: resumeLivePolling } = useTimeoutPoll(
  async () => {
    livePollAttempts.value++;
    await checkLiveStatusOnce();

    if (
      liveStatus.value === 'cert_active' ||
      livePollAttempts.value >= MAX_LIVE_POLL_ATTEMPTS
    ) {
      pauseLivePolling();
    }
  },
  5000,
  { immediate: false }
);

const liveBannerClass = computed(() => {
  switch (liveStatus.value) {
    case 'cert_active':
      return 'text-green-800 dark:text-green-400';
    case 'unreachable':
      return 'text-red-800 dark:text-red-400';
    default:
      return 'text-yellow-700 dark:text-yellow-500';
  }
});

const liveMessage = computed(() => {
  if (liveChecking.value) return t('admin.hostname.live.checking');

  switch (liveStatus.value) {
    case 'cert_active':
      return t('admin.hostname.live.active', {
        issuer: liveIssuer.value,
        expiry: liveValidTo.value,
      });
    case 'router_missing':
      return t('admin.hostname.live.routerMissing');
    case 'cert_pending':
      return t('admin.hostname.live.pending');
    case 'unreachable':
      return t('admin.hostname.live.unreachable');
    default:
      return '';
  }
});

async function checkLiveStatusOnce() {
  liveChecking.value = true;

  try {
    const result = await $fetch<HostnameLiveStatus>(
      '/api/admin/hostname/status',
      {
        method: 'post',
        body: { hostname: hostname.value },
      }
    );

    liveStatus.value = result.status;
    if (result.status === 'cert_active') {
      liveIssuer.value = result.issuer;
      liveValidTo.value = result.validTo;
    }
  } catch {
    liveStatus.value = 'unreachable';
  } finally {
    liveChecking.value = false;
  }
}

function startLiveStatusPolling() {
  livePollAttempts.value = 0;
  liveStatus.value = 'cert_pending';
  resumeLivePolling();
}

async function refreshLiveStatusNow() {
  livePollAttempts.value = 0;
  await checkLiveStatusOnce();

  if (liveStatus.value !== 'cert_active') {
    resumeLivePolling();
  }
}

watch(hostname, () => {
  dnsState.value = 'idle';
  dnsResolvedIps.value = [];
  liveStatus.value = 'idle';
  pauseLivePolling();
});

async function submit() {
  try {
    await $fetch('/api/admin/hostname', {
      method: 'post',
      body: { hostname: hostname.value },
    });

    messageType.value = 'success';
    message.value = t('admin.hostname.success');
    startLiveStatusPolling();
  } catch (e) {
    messageType.value = 'error';
    message.value = t('admin.hostname.errors.unknown');

    if (e instanceof FetchError) {
      const data = e.data as
        (HostnameValidationResult & { message?: string }) | undefined;

      if (data?.valid === false) {
        message.value = t(`admin.hostname.errors.${data.reason}`);
      } else if (data?.message) {
        // a Traefik-write failure (not a format-validation error) - show
        // the backend's own message rather than a generic fallback
        message.value = data.message;
      }
    }
  }
}

async function submitPublicIp() {
  try {
    await $fetch('/api/admin/hostname/public-ip', {
      method: 'post',
      body: { serverPublicIp: serverPublicIp.value },
    });

    publicIpMessageType.value = 'success';
    publicIpMessage.value = t('admin.hostname.publicIp.success');
  } catch (e) {
    publicIpMessageType.value = 'error';

    const reason =
      e instanceof FetchError
        ? (e.data as PublicIpValidationResult | undefined)?.valid === false
          ? e.data.reason
          : undefined
        : undefined;

    publicIpMessage.value = reason
      ? t(`admin.hostname.publicIp.errors.${reason}`)
      : t('admin.hostname.publicIp.errors.unknown');
  }
}

const certMode = ref(hostnameSettings.value?.certMode ?? 'acme');
const certFileContent = ref('');
const keyFileContent = ref('');
const certMessage = ref('');
const certMessageType = ref<'success' | 'error'>('success');
const certUploading = ref(false);

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error as Error);
    reader.readAsText(file);
  });
}

async function onCertFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) certFileContent.value = await readFileAsText(file);
}

async function onKeyFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) keyFileContent.value = await readFileAsText(file);
}

async function submitCertificate() {
  if (!certFileContent.value || !keyFileContent.value) {
    certMessageType.value = 'error';
    certMessage.value = t('admin.hostname.certificate.errors.missingFiles');
    return;
  }

  certUploading.value = true;

  try {
    const result = await $fetch<CertificateSaveResult>(
      '/api/admin/hostname/certificate',
      {
        method: 'post',
        body: {
          certificate: certFileContent.value,
          privateKey: keyFileContent.value,
        },
      }
    );

    certMode.value = 'custom';
    certMessageType.value = 'success';

    const warnings =
      result.valid && result.warnings.length > 0
        ? ` (${result.warnings
            .map((w) => t(`admin.hostname.certificate.warnings.${w}`))
            .join(', ')})`
        : '';

    certMessage.value = t('admin.hostname.certificate.success') + warnings;
    startLiveStatusPolling();
  } catch (e) {
    certMessageType.value = 'error';
    certMessage.value = t('admin.hostname.certificate.errors.unknown');

    if (e instanceof FetchError) {
      const data = e.data as
        (CertificateSaveResult & { message?: string }) | undefined;

      if (data?.valid === false) {
        certMessage.value = t(
          `admin.hostname.certificate.errors.${data.reason}`
        );
      } else if (data?.message) {
        certMessage.value = data.message;
      }
    }
  } finally {
    certUploading.value = false;
  }
}

async function switchToAutomatic() {
  certUploading.value = true;

  try {
    await $fetch('/api/admin/hostname/certificate', { method: 'delete' });

    certMode.value = 'acme';
    certMessageType.value = 'success';
    certMessage.value = t('admin.hostname.certificate.switchedToAutomatic');
    startLiveStatusPolling();
  } catch (e) {
    certMessageType.value = 'error';
    certMessage.value =
      e instanceof FetchError && (e.data as { message?: string })?.message
        ? (e.data as { message: string }).message
        : t('admin.hostname.certificate.errors.unknown');
  } finally {
    certUploading.value = false;
  }
}

async function checkDns() {
  if (!formatValidation.value.valid || dnsState.value === 'checking') return;

  dnsState.value = 'checking';
  dnsResolvedIps.value = [];

  try {
    const result = await $fetch<HostnameDnsCheckResult>(
      '/api/admin/hostname/check',
      {
        method: 'post',
        body: { hostname: hostname.value },
      }
    );

    dnsState.value = result.status;
    if (result.status === 'resolved_mismatch') {
      dnsResolvedIps.value = result.resolvedIps;
    }
  } catch (e) {
    dnsState.value =
      e instanceof FetchError && e.statusCode === 503
        ? 'not_configured'
        : 'error';
  }
}
</script>
