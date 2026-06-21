ALTER TABLE Tournaments DROP CONSTRAINT CHK_Tournaments_Status;

ALTER TABLE Tournaments ADD CONSTRAINT CHK_Tournaments_Status 
    CHECK ([Status] IN (
        'Draft',
        'Open Registration',
        'Closed Registration',
        'Pre-Race',
        'In-Progress',
        'Completed',
        'Cancelled'));