from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.call_sync import get_or_create_global_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=schemas.GlobalSettingsOut)
def get_settings_row(db: Session = Depends(get_db)):
    return get_or_create_global_settings(db)


@router.put("", response_model=schemas.GlobalSettingsOut)
def update_settings(payload: schemas.GlobalSettingsUpdate, db: Session = Depends(get_db)):
    row = get_or_create_global_settings(db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
