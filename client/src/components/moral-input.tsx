import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MoralInputProps {
  onSubmit: (moral: string) => void;
  maxLength?: number;
  defaultValue?: string;
}

export const MoralInput: React.FC<MoralInputProps> = ({
  onSubmit,
  maxLength = 120,
  defaultValue = ''
}) => {
  const [moral, setMoral] = useState(defaultValue);
  const charCount = moral.length;

  const handleSubmit = () => {
    if (moral.trim()) {
      onSubmit(moral);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-base font-medium text-gray-900 mb-2">Submit Your Moral</h4>
      <p className="text-sm text-gray-600">Create a bizarre, profound-sounding moral for this story.</p>
      
      <Textarea
        value={moral}
        onChange={(e) => setMoral(e.target.value)}
        placeholder="Perhaps the real lesson is..."
        maxLength={maxLength}
        rows={3}
        className="w-full resize-none"
      />
      
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          <span className={charCount > maxLength ? 'text-red-500' : ''}>
            {charCount}
          </span>/{maxLength} characters
        </span>
        <Button 
          onClick={handleSubmit}
          disabled={!moral.trim() || charCount > maxLength}
        >
          Submit Moral
        </Button>
      </div>
    </div>
  );
};

export default MoralInput;
