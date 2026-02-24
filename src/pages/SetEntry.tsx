/**
 * Set Entry Page
 * 
 * Allows users to set their entry ID for viewing live matchups.
 * This is a convenience feature only - not authentication.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEntryId } from "../lib/useEntryId";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function SetEntry() {
  const { entryId, setEntryId } = useEntryId();
  const [inputValue, setInputValue] = useState(entryId || "");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setEntryId(null);
      navigate("/");
      return;
    }

    const num = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(num) || num <= 0) {
      setError("Entry ID must be a positive integer");
      return;
    }

    setEntryId(trimmed);
    navigate("/");
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Set Entry ID</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your FPL entry ID to view live matchups. This is a convenience
          feature only and is not used for authentication.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entryId">Entry ID</Label>
            <Input
              id="entryId"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., 164475"
              className="mt-1"
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            {entryId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEntryId(null);
                  setInputValue("");
                  navigate("/");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>

        {entryId && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm">
              <strong>Current Entry ID:</strong> {entryId}
            </p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Your entry ID is stored in your browser's
            localStorage for convenience. It is not used for authentication or
            security purposes.
          </p>
        </div>
      </Card>
    </div>
  );
}
