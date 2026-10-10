import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  shape?: 'square' | 'rounded';
  size?: 'sm' | 'md' | 'lg';
}

export function ImageUpload({ value, onChange, label = 'Image', shape = 'square', size = 'md' }: ImageUploadProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const dims = {
    sm: 'w-20 h-20',
    md: 'w-28 h-28',
    lg: 'w-36 h-36',
  }[size];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('shop-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shop-images')
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      showToast('Image uploaded successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div className={`relative ${dims} ${shape === 'rounded' ? 'rounded-full' : 'rounded-xl'} border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center`}>
          {value ? (
            <>
              <img src={value} alt="" className="w-full h-full object-cover" />
              <button
                onClick={handleRemove}
                className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-md"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : uploading ? (
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1.5 disabled:opacity-50"
            type="button"
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? 'Change' : 'Upload'}
          </button>
          <p className="text-[10px] text-gray-400">PNG, JPG up to 5MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
