import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  open,
  onClose
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Game Rules</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-2">Game Overview</h4>
            <DialogDescription>
              QRAMO (Questionable Retroactive Apathetic Moral Offerings) is a storytelling card game where players create bizarre narratives with escalating twists, then compete to create the most entertaining moral for the story.
            </DialogDescription>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-2">Card Types</h4>
            <ul className="space-y-2 text-gray-600 list-disc pl-5">
              <li><span className="font-medium text-red-500">Red Cards (Character)</span>: The main protagonist of the story</li>
              <li><span className="font-medium text-blue-500">Blue Cards (Setting)</span>: Where the story takes place</li>
              <li><span className="font-medium text-emerald-500">Green Cards (Initial Twist)</span>: The first strange occurrence</li>
              <li><span className="font-medium text-amber-500">Yellow Cards (Escalation)</span>: How things get even weirder</li>
              <li><span className="font-medium text-purple-500">Purple Cards (Final Twist)</span>: The shocking conclusion</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-2">Game Flow</h4>
            <ol className="space-y-2 text-gray-600 list-decimal pl-5">
              <li>Each player is assigned a card type (rotates each round)</li>
              <li>Players receive 3 cards of their assigned type</li>
              <li>Everyone selects 1 card to contribute to the story</li>
              <li>The system assembles all chosen cards into a coherent story</li>
              <li>Players write a "moral of the story" based on the assembled narrative</li>
              <li>Everyone votes for their favorite moral (you can't vote for your own)</li>
              <li>Points are awarded based on votes received</li>
              <li>Card types rotate and a new round begins</li>
              <li>After 5 rounds, the player with the most points wins</li>
            </ol>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-2">AI Players</h4>
            <DialogDescription>
              If fewer than 5 human players join, AI players will automatically fill the remaining slots. 
              They select cards and generate morals using AI.
            </DialogDescription>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-2">Tips for Great Morals</h4>
            <ul className="space-y-2 text-gray-600 list-disc pl-5">
              <li>Use overly formal or philosophical language</li>
              <li>Add bizarre metaphors that almost make sense</li>
              <li>Include non-sequiturs (statements that don't logically follow)</li>
              <li>End with something ominous or confusing</li>
              <li>The funnier or more absurd, the better!</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Got It</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RulesModal;
