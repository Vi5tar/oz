oz() {
  local temp_file
  temp_file=$(mktemp)
  
  command oz "$@" 3> "$temp_file"
  
  while IFS= read -r line; do
    if [[ "$line" == export* ]] || [[ "$line" == unset* ]]; then
      eval "$line"
    fi
  done < "$temp_file"
  
  rm "$temp_file"
}
