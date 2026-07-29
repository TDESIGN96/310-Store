import { ref } from 'vue'

const ATTACHMENT_PATTERN = /\.(jpe?g|png|pdf)(\?.*)?$/i
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024

interface UploadedFileResponse {
  data?: {
    file?: {
      path?: string
      url?: string
    }
  }
}

/** Shared file-selection + upload logic for the invoice `attachment_path` field. */
export function useInvoiceAttachment(i18nPrefix: 'invoices_page' | 'transport_invoices_page' = 'invoices_page') {
  const config = useRuntimeConfig()
  const { t } = useI18n()

  const attachmentFile = ref<File | null>(null)
  const attachmentError = ref('')

  const onAttachmentFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    attachmentError.value = ''
    if (!file) {
      attachmentFile.value = null
      return
    }
    if (!ATTACHMENT_PATTERN.test(file.name) || file.size > MAX_ATTACHMENT_SIZE) {
      attachmentError.value = t(`${i18nPrefix}.attachment_invalid_type`)
      attachmentFile.value = null
      input.value = ''
      return
    }
    attachmentFile.value = file
  }

  const removeAttachmentFile = () => {
    attachmentFile.value = null
    attachmentError.value = ''
  }

  const uploadAttachmentIfNeeded = async (token: string | null | undefined, currentPath: string): Promise<string> => {
    if (!attachmentFile.value) return currentPath
    if (!token) throw new Error('Authentication token is required to upload the attachment')

    const base = String(config.public.apiBase ?? '').replace(/\/$/, '')
    const formData = new FormData()
    formData.append('file', attachmentFile.value)

    const uploadResult = await $fetch<UploadedFileResponse>(`${base}/files`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    const fileUrl = uploadResult?.data?.file?.url || uploadResult?.data?.file?.path
    if (!fileUrl) throw new Error('File upload response did not include url/path')
    attachmentFile.value = null
    return fileUrl
  }

  return {
    attachmentFile,
    attachmentError,
    onAttachmentFileChange,
    removeAttachmentFile,
    uploadAttachmentIfNeeded,
  }
}
