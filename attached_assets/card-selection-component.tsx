className={`relative p-4 rounded-lg ${card.isCustom ? `card-type-${normalizedType} card-header-${normalizedType}` : `card-type-${normalizedType}`} ${
  selectedCardId === card.id 
    ? 'ring-2 ring-offset-2 ring-primary'
    : 'hover:scale-105 transition-transform'
} card-container`}