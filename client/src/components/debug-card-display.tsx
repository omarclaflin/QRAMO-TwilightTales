import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { CardGrid } from '@/components/card';
import { Card as CardType } from '@shared/schema';

/**
 * Debug component to verify card styling
 */
export function DebugCardDisplay() {
  // Test cards for all types
  const testCards: CardType[] = [
    {
      id: 101,
      text: "Location test card",
      type: "location",
    },
    {
      id: 102,
      text: "Character test card",
      type: "character",
    },
    {
      id: 103,
      text: "Initial Twist test card",
      type: "initialTwist", 
    },
    {
      id: 104,
      text: "Escalation test card",
      type: "escalation",
    },
    {
      id: 105,
      text: "Final Twist test card",
      type: "finalTwist",
    },
    // Variations in formatting to test our fix
    {
      id: 106,
      text: "Location (hyphenated) test card",
      type: "location-card",
    },
    {
      id: 107,
      text: "Initial Twist (lowercase) test card", 
      type: "initialtwist",
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold">Debug Card Display</h3>
          <p className="text-sm text-muted-foreground">
            This component shows all card types to verify styling.
            Card component version: v1.0.2
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Normal CardGrid:</h4>
              <CardGrid 
                cards={testCards} 
                cardSize="md"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Applied CSS classes will be shown below each card
        </CardFooter>
      </Card>
    </div>
  );
}